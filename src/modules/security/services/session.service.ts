import { Request, Response } from "express";
import { injectable } from "tsyringe";
import jwt from "jsonwebtoken";

import { webauthn } from "@/conf/env";

@injectable()
export class SessionService {
  public issue(response: Response) {
    const token = jwt.sign({ typ: "session" }, this.requireApprovalSecret(), {
      expiresIn: webauthn.session_ttl_seconds,
    });

    response.cookie(webauthn.session_cookie_name, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: webauthn.session_ttl_seconds * 1000,
    });
  }

  public clear(response: Response) {
    response.clearCookie(webauthn.session_cookie_name);
  }

  public isAuthenticated(request: Request): boolean {
    const token = request.cookies?.[webauthn.session_cookie_name];
    if (!token) return false;

    try {
      const payload = jwt.verify(token, this.requireApprovalSecret()) as {
        typ: string;
      };
      return payload.typ === "session";
    } catch {
      return false;
    }
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
