import { injectable } from "tsyringe";
import { Request, Response } from "express";

import { genericResponse } from "@/common/utils/http";
import { ForbiddenError } from "@/common/utils/errors/app.error";
import { PasskeyService } from "./services/passkey.service";
import { SessionService } from "./services/session.service";
import {
  ApprovalOptionsDto,
  ApprovalVerifyDto,
  RegistrationVerifyDto,
} from "./dto/validation.dto";

@injectable()
export class SecurityController {
  constructor(
    private readonly passkeyService: PasskeyService,
    private readonly sessionService: SessionService,
  ) {}

  public list = async (_request: Request, response: Response) => {
    const data = await this.passkeyService.listCredentials();
    return genericResponse({ response, data });
  };

  public exists = async (_request: Request, response: Response) => {
    const hasAny = await this.passkeyService.hasCredentials();
    return genericResponse({
      response,
      data: { status: true, message: "ok", data: { exists: hasAny } },
    });
  };

  public remove = async (request: Request, response: Response) => {
    const { passkey_id } = request.params;
    const data = await this.passkeyService.removeCredential(passkey_id);
    return genericResponse({ response, data });
  };

  public registrationOptions = async (request: Request, response: Response) => {
    const hasAny = await this.passkeyService.hasCredentials();

    if (hasAny && !this.sessionService.isAuthenticated(request)) {
      throw new ForbiddenError(
        "Sign in with an existing passkey before adding another",
      );
    }

    const data = await this.passkeyService.generateRegistrationOptions();
    return genericResponse({ response, data });
  };

  public registrationVerify = async (request: Request, response: Response) => {
    const hadNoCredentialsYet = !(await this.passkeyService.hasCredentials());

    if (!hadNoCredentialsYet && !this.sessionService.isAuthenticated(request)) {
      throw new ForbiddenError(
        "Sign in with an existing passkey before adding another",
      );
    }

    const {
      session_id,
      response: assertion,
      label,
    } = request.body as RegistrationVerifyDto;

    const data = await this.passkeyService.verifyRegistration(
      session_id,
      assertion,
      label,
    );

    if (hadNoCredentialsYet) this.sessionService.issue(response);

    return genericResponse({ response, data });
  };

  public approvalOptions = async (request: Request, response: Response) => {
    const { action } = request.body as ApprovalOptionsDto;
    const data = await this.passkeyService.generateApprovalOptions(action);
    return genericResponse({ response, data });
  };

  public approvalVerify = async (request: Request, response: Response) => {
    const { session_id, response: assertion } =
      request.body as ApprovalVerifyDto;
    const data = await this.passkeyService.verifyApproval(
      session_id,
      assertion,
    );

    if (data.data?.action === "login") this.sessionService.issue(response);

    return genericResponse({ response, data });
  };

  public sessionStatus = async (request: Request, response: Response) => {
    return genericResponse({
      response,
      data: {
        status: true,
        message: "Session status",
        data: { authenticated: this.sessionService.isAuthenticated(request) },
      },
    });
  };

  public logout = async (_request: Request, response: Response) => {
    this.sessionService.clear(response);
    return genericResponse({
      response,
      data: { status: true, message: "Signed out" },
    });
  };
}
