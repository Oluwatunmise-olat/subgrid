import { injectable } from "tsyringe";
import { Request, Response } from "express";

import { genericResponse } from "@/common/utils/http";
import { LlmSettingsService } from "./services/llm-settings.service";
import { SetLlmSettingsDto } from "./dto/validation.dto";

@injectable()
export class LlmSettingsController {
  constructor(private readonly llmSettingsService: LlmSettingsService) {}

  public status = async (_request: Request, response: Response) => {
    const data = await this.llmSettingsService.getStatus();

    return genericResponse({ response, data });
  };

  public set = async (request: Request, response: Response) => {
    const payload = request.body as SetLlmSettingsDto;

    const data = await this.llmSettingsService.set(payload);

    return genericResponse({ response, data });
  };

  public clear = async (request: Request, response: Response) => {
    const { approval_token } = request.query as { approval_token?: string };

    const data = await this.llmSettingsService.clear(approval_token);

    return genericResponse({ response, data });
  };
}
