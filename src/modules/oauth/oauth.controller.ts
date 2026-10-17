import { injectable } from "tsyringe";
import { Request, Response } from "express";

import { genericResponse } from "@/common/utils/http";
import { app } from "@/conf/env";
import { McpOAuthService } from "./services/oauth.service";

@injectable()
export class McpOAuthController {
  constructor(private readonly mcpOAuthService: McpOAuthService) {}

  public initiate = async (request: Request, response: Response) => {
    const { server_id } = request.params;

    const data = await this.mcpOAuthService.initiate(server_id);

    return genericResponse({ response, data });
  };

  public callback = async (request: Request, response: Response) => {
    const { server_id } = request.params;

    const { code, state, error, error_description } = request.query as {
      code?: string;
      state?: string;
      error?: string;
      error_description?: string;
    };

    if (error) {
      return response.redirect(
        `${app.client_url}/?oauth_error=${encodeURIComponent(error_description || error)}`,
      );
    }

    if (!code || !state) {
      return response.redirect(
        `${app.client_url}/?oauth_error=${encodeURIComponent("Missing code or state")}`,
      );
    }

    try {
      await this.mcpOAuthService.handleCallback(server_id, code, state);

      return response.redirect(
        `${app.client_url}/?oauth=connected&server_id=${server_id}`,
      );
    } catch (err) {
      return response.redirect(
        `${app.client_url}/?oauth_error=${encodeURIComponent((err as Error).message)}`,
      );
    }
  };

  public status = async (request: Request, response: Response) => {
    const { server_id } = request.params;

    const data = await this.mcpOAuthService.status(server_id);

    return genericResponse({ response, data });
  };

  public disconnect = async (request: Request, response: Response) => {
    const { server_id } = request.params;

    const data = await this.mcpOAuthService.disconnect(server_id);

    return genericResponse({ response, data });
  };
}
