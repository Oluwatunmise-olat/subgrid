import crypto from "crypto";
import { injectable } from "tsyringe";
import jwt from "jsonwebtoken";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";

import {
  WebauthnCredentialsRepository,
  PasskeyChallengesRepository,
} from "@/repositories";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from "@/common/utils/errors/app.error";
import { webauthn } from "@/conf/env";
import { PasskeyChallengeType } from "@/models/passkey-challenge.model";
import { CHALLENGE_TTL_MS } from "@/common/constants/passkey.constants";

@injectable()
export class PasskeyService {
  constructor(
    private readonly webauthnCredentialsRepository: WebauthnCredentialsRepository,
    private readonly passkeyChallengesRepository: PasskeyChallengesRepository,
  ) {}

  public async hasCredentials() {
    const credentials = await this.webauthnCredentialsRepository.findMany({});

    return credentials.length > 0;
  }

  public async listCredentials() {
    const credentials = await this.webauthnCredentialsRepository.findMany({});

    return {
      status: true,
      message: "Passkeys retrieved",
      data: {
        passkeys: credentials.map((c) => ({
          id: c.id,
          label: c.label,
          created_at: c.created_at,
          last_used_at: c.last_used_at,
        })),
      },
    };
  }

  public async removeCredential(id: string) {
    const existing = await this.webauthnCredentialsRepository.getById(id);

    if (!existing) throw new NotFoundError("Passkey not found");

    await this.webauthnCredentialsRepository.delete({
      id,
    });

    return { status: true, message: "Passkey removed" };
  }

  public async generateRegistrationOptions() {
    await this.passkeyChallengesRepository.deleteExpired();

    const existing = await this.webauthnCredentialsRepository.findMany({});

    const options = await generateRegistrationOptions({
      rpName: webauthn.rp_name,
      rpID: webauthn.rp_id,
      userName: "subgrid-admin",
      userID: crypto.randomBytes(16),
      attestationType: "none",
      excludeCredentials: existing.map((c) => ({ id: c.credential_id })),
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
    });

    const created = await this.passkeyChallengesRepository.create({
      challenge: options.challenge,
      type: "registration",
      action: null,
      expires_at: new Date(Date.now() + CHALLENGE_TTL_MS).toISOString(),
    });

    return {
      status: true,
      message: "Registration options generated",
      data: { session_id: created.id, options },
    };
  }

  public async verifyRegistration(
    sessionId: string,
    response: any,
    label?: string,
  ) {
    const pending = await this.consumeChallenge(sessionId, "registration");

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: pending.challenge,
      expectedOrigin: webauthn.origin,
      expectedRPID: webauthn.rp_id,
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw new BadRequestError("Passkey registration could not be verified");
    }

    const { credential } = verification.registrationInfo;

    await this.webauthnCredentialsRepository.create({
      credential_id: credential.id,
      public_key: Buffer.from(credential.publicKey).toString("base64url"),
      counter: credential.counter,
      transports: credential.transports || null,
      label: label || "Passkey",
    });

    return { status: true, message: "Passkey registered" };
  }

  public async generateApprovalOptions(action: string) {
    await this.passkeyChallengesRepository.deleteExpired();

    const existing = await this.webauthnCredentialsRepository.findMany({});

    if (existing.length === 0) {
      throw new BadRequestError(
        "No passkeys registered yet. Set one up first.",
      );
    }

    const options = await generateAuthenticationOptions({
      rpID: webauthn.rp_id,
      allowCredentials: existing.map((c) => ({
        id: c.credential_id,
        transports: (c.transports as any) || undefined,
      })),
      userVerification: "preferred",
    });

    const created = await this.passkeyChallengesRepository.create({
      challenge: options.challenge,
      type: "approval",
      action,
      expires_at: new Date(Date.now() + CHALLENGE_TTL_MS).toISOString(),
    });

    return {
      status: true,
      message: "Approval options generated",
      data: { session_id: created.id, options },
    };
  }

  public async verifyApproval(sessionId: string, response: any) {
    const pending = await this.consumeChallenge(sessionId, "approval");

    if (!pending.action) {
      throw new BadRequestError(
        "Approval session expired or invalid. Try again.",
      );
    }

    const stored = await this.webauthnCredentialsRepository.getByCredentialId(
      response.id,
    );

    if (!stored) throw new BadRequestError("Unrecognized passkey");

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: pending.challenge,
      expectedOrigin: webauthn.origin,
      expectedRPID: webauthn.rp_id,
      credential: {
        id: stored.credential_id,
        publicKey: Buffer.from(stored.public_key, "base64url"),
        counter: stored.counter,
        transports: (stored.transports as any) || undefined,
      },
    });

    if (!verification.verified) {
      throw new BadRequestError("Passkey approval could not be verified");
    }

    await this.webauthnCredentialsRepository.update(
      { id: stored.id },
      {
        counter: verification.authenticationInfo.newCounter,
        last_used_at: new Date().toISOString(),
      },
    );

    const token = jwt.sign(
      { action: pending.action },
      this.requireApprovalSecret(),
      { expiresIn: webauthn.approval_ttl_seconds },
    );

    return {
      status: true,
      message: "Approved",
      data: { approval_token: token, action: pending.action },
    };
  }

  public verifyApprovalToken(
    token: string | undefined,
    expectedAction: string,
  ) {
    if (!token)
      throw new ForbiddenError(
        "A passkey approval is required for this action",
      );

    try {
      const payload = jwt.verify(token, this.requireApprovalSecret()) as {
        action: string;
      };

      if (payload.action !== expectedAction) {
        throw new ForbiddenError(
          "Approval token was issued for a different action",
        );
      }
    } catch (err) {
      if (err instanceof ForbiddenError) throw err;

      throw new ForbiddenError(
        "Passkey approval is invalid or expired. Approve again.",
      );
    }
  }

  private async consumeChallenge(
    sessionId: string,
    expectedType: "registration" | "approval",
  ): Promise<PasskeyChallengeType> {
    const pending = (await this.passkeyChallengesRepository.getById(
      sessionId,
    )) as unknown as PasskeyChallengeType | undefined;

    const expired =
      pending !== undefined &&
      new Date(pending.expires_at).getTime() < Date.now();

    if (!pending || pending.type !== expectedType || expired) {
      throw new BadRequestError(
        expectedType === "registration"
          ? "Registration session expired or invalid. Try again."
          : "Approval session expired or invalid. Try again.",
      );
    }

    await this.passkeyChallengesRepository.delete({ id: pending.id }, false);

    return pending;
  }

  private requireApprovalSecret() {
    if (!webauthn.approval_secret) {
      throw new Error(
        "APPROVAL_SECRET must be set to a random string. Generate one with `openssl rand -hex 32`.",
      );
    }

    return webauthn.approval_secret;
  }
}
