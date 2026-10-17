import { injectable } from "tsyringe";

import { LlmSettingsRepository } from "@/repositories";
import { PasskeyService } from "@/modules/security/services/passkey.service";
import { OpenAIllmProcessor } from "@/common/implementations/llm/openai";
import { encryptJson, decryptJson } from "@/common/utils/encrypt-decrypt";
import { embedders } from "@/conf/env";
import { LlmOverride } from "@/common/types/llm";
import { SetLlmSettingsDto } from "../dto/validation.dto";

const LLM_SETTINGS_APPROVAL_ACTION = "store_llm_settings";

@injectable()
export class LlmSettingsService {
  constructor(
    private readonly llmSettingsRepository: LlmSettingsRepository,
    private readonly passkeyService: PasskeyService,
    private readonly openAIllmProcessor: OpenAIllmProcessor,
  ) {}

  public async getStatus() {
    const current = await this.llmSettingsRepository.getCurrent();

    if (current) {
      return {
        status: true,
        message: "LLM settings retrieved",
        data: {
          configured: true,
          provider: current.provider,
          source: "stored" as const,
        },
      };
    }

    if (this.openAIllmProcessor.isConfigured()) {
      return {
        status: true,
        message: "LLM settings retrieved",
        data: {
          configured: true,
          provider: embedders.openai.apiKey ? "openai" : "openrouter",
          source: "env" as const,
        },
      };
    }

    return {
      status: true,
      message: "LLM settings retrieved",
      data: { configured: false, provider: null, source: null },
    };
  }

  public async getActiveOverride(): Promise<LlmOverride | undefined> {
    const current = await this.llmSettingsRepository.getCurrent();

    if (!current) return undefined;

    const apiKey = decryptJson<string>({
      cipher_text: current.secrets_cipher,
      nonce: current.secrets_nonce,
      tag: current.secrets_tag,
    });

    return { apiKey, provider: current.provider };
  }

  public async set(payload: SetLlmSettingsDto) {
    await this.requireApproval(payload.approval_token);

    const encrypted = encryptJson(payload.api_key);

    const current = await this.llmSettingsRepository.getCurrent();

    const fields = {
      provider: payload.provider,
      secrets_cipher: encrypted.cipher_text,
      secrets_nonce: encrypted.nonce,
      secrets_tag: encrypted.tag,
    };

    if (current) {
      await this.llmSettingsRepository.update({ id: current.id }, fields);
    } else {
      await this.llmSettingsRepository.create(fields);
    }

    return { status: true, message: "LLM settings saved" };
  }

  public async clear(approvalToken: string | undefined) {
    await this.requireApproval(approvalToken);

    const current = await this.llmSettingsRepository.getCurrent();

    if (current) await this.llmSettingsRepository.delete({ id: current.id });

    return { status: true, message: "LLM settings cleared" };
  }

  private async requireApproval(approvalToken: string | undefined) {
    if (!(await this.passkeyService.hasCredentials())) return;

    this.passkeyService.verifyApprovalToken(
      approvalToken,
      LLM_SETTINGS_APPROVAL_ACTION,
    );
  }
}
