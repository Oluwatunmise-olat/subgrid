import { ChatOpenAI } from "@langchain/openai";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { singleton } from "tsyringe";
import { ZodType } from "zod";

import { embedders, llm as llmConfig } from "@/conf/env";
import { LlmTimeoutError } from "@/common/utils/errors/app.error";
import { extractJson } from "@/common/utils/json";
import { LlmOverride } from "@/common/types/llm";
import { LlmPlanResult, LlmToolSpec } from "@/common/types/planning";

@singleton()
export class OpenAIllmProcessor {
  private llmInstance: ChatOpenAI | null = null;

  public isConfigured(): boolean {
    return Boolean(embedders.openai.apiKey || embedders.openrouter.apiKey);
  }

  private getLlm(override?: LlmOverride): ChatOpenAI {
    if (override?.apiKey) {
      const useOpenRouter = override.provider === "openrouter";

      return new ChatOpenAI({
        apiKey: override.apiKey,
        model: useOpenRouter
          ? embedders.openrouter.model
          : embedders.openai.chat_model,
        maxRetries: 2,
        temperature: 0.1,
        maxTokens: llmConfig.max_output_tokens,
        ...(useOpenRouter
          ? { configuration: { baseURL: embedders.openrouter.baseUrl } }
          : {}),
      });
    }

    const useOpenRouter =
      !embedders.openai.apiKey && Boolean(embedders.openrouter.apiKey);
    const apiKey = useOpenRouter
      ? embedders.openrouter.apiKey
      : embedders.openai.apiKey;

    if (!apiKey) {
      throw new Error(
        "Set OPENAI_API_KEY or OPENROUTER_API_KEY to enable planning.",
      );
    }

    if (!this.llmInstance) {
      this.llmInstance = new ChatOpenAI({
        apiKey,
        model: useOpenRouter
          ? embedders.openrouter.model
          : embedders.openai.chat_model,
        maxRetries: 2,
        temperature: 0.1,
        maxTokens: llmConfig.max_output_tokens,
        ...(useOpenRouter
          ? { configuration: { baseURL: embedders.openrouter.baseUrl } }
          : {}),
      });
    }

    return this.llmInstance;
  }

  public async completeJson<T>(
    systemPrompt: string,
    userPrompt: string,
    schema: ZodType<T>,
    timeoutMs?: number,
    override?: LlmOverride,
  ): Promise<T> {
    const llm = this.getLlm(override);
    const signal = AbortSignal.timeout(timeoutMs || llmConfig.timeout_ms);

    try {
      const response = (await llm.invoke(
        [new SystemMessage(systemPrompt), new HumanMessage(userPrompt)],
        { signal },
      )) as AIMessage;

      const text = typeof response.content === "string" ? response.content : "";

      return schema.parse(JSON.parse(extractJson(text)));
    } catch (error: any) {
      if (error.name === "TimeoutError" || error.name === "AbortError") {
        throw new LlmTimeoutError();
      }
      throw error;
    }
  }

  public async planWithTools(
    systemPrompt: string,
    conversation: { role: "user" | "assistant"; content: string }[],
    tools: LlmToolSpec[],
    override?: LlmOverride,
  ): Promise<LlmPlanResult> {
    const llm = this.getLlm(override);
    const signal = AbortSignal.timeout(llmConfig.timeout_ms);

    const boundLlm = tools.length
      ? llm.bindTools(
          tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            schema: tool.schema,
          })),
        )
      : llm;

    const messages = [
      new SystemMessage(systemPrompt),
      ...conversation.map((turn) =>
        turn.role === "user"
          ? new HumanMessage(turn.content)
          : new AIMessage(turn.content),
      ),
    ];

    try {
      const response = (await boundLlm.invoke(messages, {
        signal,
      })) as AIMessage;

      return {
        toolCalls: (response.tool_calls || []).map((call) => ({
          name: call.name,
          args: call.args,
        })),
        text: typeof response.content === "string" ? response.content : "",
      };
    } catch (error: any) {
      if (error.name === "TimeoutError" || error.name === "AbortError") {
        throw new LlmTimeoutError();
      }
      throw error;
    }
  }
}
