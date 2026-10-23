import { injectable } from "tsyringe";

import { McpServersRepository } from "@/repositories";
import { McpServerType } from "@/models/mcp-server.model";
import { BadRequestError } from "@/common/utils/errors/app.error";
import { OpenAIllmProcessor } from "@/common/implementations/llm/openai";
import { LlmSettingsService } from "@/modules/llm-settings/services/llm-settings.service";
import { PLANNING_PROMPTS } from "@/common/utils/planning-prompts";
import { mentionsComponent } from "@/common/utils/component-match";
import { getCachedToolManifest } from "@/common/utils/tool-manifest-cache";
import {
  CachedToolEntry,
  DiscoveredTool,
  LlmPlanResult,
  LlmToolCall,
  LlmToolSpec,
  RequestedCapability,
  ToolEntry,
} from "@/common/types/planning";
import { LlmOverride } from "@/common/types/llm";
import { RequestEntities } from "@/common/types/entities";
import {
  inferRequestCapability,
  isConfidentOperation,
  isReadOnlyOperation,
} from "@/common/utils/tool-capability";
import { WorkflowRuntimeService } from "@/modules/workflows/services/workflow-runtime.service";
import { stripUnavailableReferences } from "@/common/utils/step-input";
import { insertMissingLookups } from "@/common/utils/lookup-insertion";
import { budgetTools } from "@/common/utils/tool-budget";
import {
  actionOverlap,
  capabilityLabel,
  capabilityScore,
  isDocumentationRequest,
  isDocumentationTool,
  isFastPathCandidate,
  relevanceScore,
  resolveArgsFromEntities,
  resourceOverlap,
  resourceTokens,
} from "@/common/utils/tool-ranking";
import { OPERATIONAL_INTENT } from "@/common/constants/tool-vocabulary";

@injectable()
export class PlanningService {
  constructor(
    private readonly mcpServersRepository: McpServersRepository,
    private readonly openAIllmProcessor: OpenAIllmProcessor,
    private readonly workflowRuntimeService: WorkflowRuntimeService,
    private readonly llmSettingsService: LlmSettingsService,
  ) {}

  public async plan(
    projectId: string,
    message: string,
    history: { role: "user" | "assistant"; content: string }[] = [],
  ) {
    const llmOverride = await this.llmSettingsService.getActiveOverride();

    const servers = (await this.mcpServersRepository.findMany({
      project_id: projectId,
    })) as unknown as McpServerType[];

    if (!servers.length) {
      return {
        status: true,
        message: "No components",
        data: {
          type: "answer",
          text: "This project has no components connected yet - add one first.",
        },
      };
    }

    const { discoveredTools, unreachable } = await this.discoverTools(
      servers,
      message,
    );

    const requestedResources = resourceTokens(message);

    const requestedCapability = inferRequestCapability(message);

    const { usableTools, resourceMatchedTools } = this.toolsRelevantToMessage(
      discoveredTools,
      servers,
      message,
    );

    if (requestedResources.length > 0 && resourceMatchedTools.length === 0) {
      const capability = capabilityLabel(message, requestedResources);

      const connected = servers.map((server) => server.name).join(", ");

      return {
        status: true,
        message: "No matching capability",
        data: {
          type: "question",
          code: "missing-executable-capability",
          capability,
          text: `No executable ${capability} action is connected. Documentation tools are research-only and will not be used to perform this request.${connected ? ` Connected components: ${connected}.` : ""} Connect an execution component, then try again.`,
        },
      };
    }

    const resourceCandidates =
      requestedResources.length > 0 ? resourceMatchedTools : usableTools;

    const { relevantTools, llmTools, toolIndex } = this.selectToolsForPlanner(
      resourceCandidates,
      discoveredTools,
      message,
      requestedCapability,
    );

    if (!llmTools.length) {
      return {
        status: true,
        message: "No tools available",
        data: {
          type: "answer",
          text: `None of this project's connected components are reachable right now${unreachable.length ? ` (${unreachable.join(", ")})` : ""}.`,
        },
      };
    }

    const fastPath = relevantTools.find(
      (tool) =>
        isFastPathCandidate(message, tool, requestedCapability.entities) &&
        capabilityScore(requestedCapability, tool.entry) >= 30,
    );

    const strongMatches = this.strongCapabilityMatches(
      fastPath,
      relevantTools,
      requestedCapability,
    );

    const singleStrongMatch =
      strongMatches.length === 1 ? strongMatches[0] : null;

    let result = this.directToolCallResult(
      fastPath,
      singleStrongMatch,
      requestedCapability,
    );

    if (!result) {
      try {
        result = await this.openAIllmProcessor.planWithTools(
          this.buildSystemPrompt(servers),
          [...history, { role: "user", content: message }],
          llmTools,
          llmOverride,
        );
      } catch (err) {
        throw this.translateLlmError(err, llmOverride);
      }
    }

    if (!result.toolCalls.length && strongMatches[0]) {
      const fallback = strongMatches[0];

      result = this.singleToolResult(
        fallback,
        requestedCapability.entities,
        `Matched the request to ${fallback.entry.server.name}. Fill in the required inputs, then approve.`,
      );
    }

    if (!result.toolCalls.length) {
      return {
        status: true,
        message: "Clarification needed",
        data: {
          type: "question",
          text: result.text || "I need more detail to act on that.",
        },
      };
    }

    const steps = this.buildWorkflowSteps(
      result.toolCalls,
      toolIndex,
      discoveredTools,
      message,
      requestedResources,
      requestedCapability,
    );

    if (!steps.length) {
      return {
        status: true,
        message: "Clarification needed",
        data: {
          type: "question",
          text: "I couldn't safely match that request to a connected component. Clarify the target service or resource and try again.",
        },
      };
    }

    const workflow = await this.workflowRuntimeService.createFromPlan({
      projectId,
      request: message,
      note: result.text || null,
      executionMode: "sequential",
      steps: steps.map((step) => ({
        serverId: step.server_id,
        toolName: step.tool_name,
        input: step.input,
        capability: step.capability,
        title: step.tool_name,
        intent: step.intent,
      })),
    });

    return {
      status: true,
      message: "Plan generated",
      data: { type: "workflow", workflow },
    };
  }

  private async discoverTools(servers: McpServerType[], message: string) {
    const discoveredTools: DiscoveredTool[] = [];

    const unreachable: string[] = [];

    await Promise.all(
      servers.map(async (server, serverIndex) => {
        try {
          const tools = await getCachedToolManifest(server);

          tools.forEach((tool, toolPosition) => {
            const callName = `s${serverIndex}_t${toolPosition}`;
            discoveredTools.push(
              this.buildDiscoveredTool(server, tool, callName, message),
            );
          });
        } catch {
          unreachable.push(server.name);
        }
      }),
    );

    return { discoveredTools, unreachable };
  }

  private buildDiscoveredTool(
    server: McpServerType,
    tool: CachedToolEntry,
    callName: string,
    message: string,
  ): DiscoveredTool {
    const entry: ToolEntry = {
      server,
      toolName: tool.toolName,
      description: tool.description,
      schema: tool.schema,
      capability: tool.capability,
    };

    const capabilityPath = [
      tool.capability.resource,
      tool.capability.operation,
      tool.capability.target,
    ]
      .filter(Boolean)
      .join("/");

    const spec: LlmToolSpec = {
      name: callName,
      description: `[${server.name}] ${tool.toolName} - ${tool.description} Capability: ${capabilityPath}. Required inputs: ${tool.capability.requiredInputs.join(", ") || "none"}.`,
      schema: tool.schema,
    };

    const score = relevanceScore(message, {
      name: tool.toolName,
      description: tool.description,
      serverName: server.name,
    });

    return { callName, entry, spec, score };
  }

  private toolsRelevantToMessage(
    discoveredTools: DiscoveredTool[],
    servers: McpServerType[],
    message: string,
  ) {
    const lowerMessage = message.toLowerCase();

    const isOperationalRequest =
      OPERATIONAL_INTENT.find((term) => lowerMessage.includes(term)) !==
      undefined;

    const skipDocumentationTools =
      isOperationalRequest && !isDocumentationRequest(message);

    const intentFilteredTools = skipDocumentationTools
      ? discoveredTools.filter(
          (tool) => !isDocumentationTool(tool.entry.toolName),
        )
      : discoveredTools;

    const mentionedServerIds = new Set(
      servers
        .filter((server) => mentionsComponent(message, server.name))
        .map((server) => server.id),
    );

    const toolsFromMentionedServers = mentionedServerIds.size
      ? intentFilteredTools.filter((tool) =>
          mentionedServerIds.has(tool.entry.server.id),
        )
      : [];

    const usableTools = toolsFromMentionedServers.length
      ? toolsFromMentionedServers
      : intentFilteredTools;

    const resourceMatchedTools = usableTools.filter(
      (tool) =>
        resourceOverlap(message, {
          name: tool.entry.toolName,
          description: tool.entry.description,
          serverName: tool.entry.server.name,
        }).length > 0,
    );

    return { usableTools, resourceMatchedTools };
  }

  private selectToolsForPlanner(
    resourceCandidates: DiscoveredTool[],
    discoveredTools: DiscoveredTool[],
    message: string,
    requestedCapability: RequestedCapability,
  ) {
    const scoredByCapability = resourceCandidates
      .map((tool) => ({
        ...tool,
        capabilityScore: capabilityScore(requestedCapability, tool.entry),
      }))
      .filter((tool) => tool.capabilityScore >= 0);

    const capabilityFilteredTools =
      scoredByCapability.length > 0
        ? scoredByCapability
        : resourceCandidates.map((tool) => ({ ...tool, capabilityScore: 0 }));

    const actionMatchedTools = capabilityFilteredTools.filter(
      (tool) => actionOverlap(message, tool.entry.toolName).length > 0,
    );

    const candidateTools =
      actionMatchedTools.length > 0
        ? actionMatchedTools
        : capabilityFilteredTools;

    const hasScoredCandidate =
      candidateTools.find((tool) => tool.score > 0) !== undefined;

    const bestCandidates = hasScoredCandidate
      ? candidateTools
          .filter((tool) => tool.score > 0)
          .sort((a, b) => b.score - a.score)
      : discoveredTools;

    const relevantTools = budgetTools(bestCandidates);

    const toolIndex = new Map<string, ToolEntry>();

    const llmTools = relevantTools.map((tool) => {
      toolIndex.set(tool.callName, tool.entry);
      return tool.spec;
    });

    return { relevantTools, llmTools, toolIndex };
  }

  private strongCapabilityMatches(
    fastPath: DiscoveredTool | undefined,
    relevantTools: DiscoveredTool[],
    requestedCapability: RequestedCapability,
  ): DiscoveredTool[] {
    if (fastPath) return [];

    return relevantTools.filter(
      (tool) => capabilityScore(requestedCapability, tool.entry) >= 30,
    );
  }

  private singleToolResult(
    candidate: DiscoveredTool,
    entities: RequestEntities,
    note: string,
  ): LlmPlanResult {
    return {
      toolCalls: [
        {
          name: candidate.callName,
          args: resolveArgsFromEntities(candidate.entry, entities).args,
        },
      ],
      text: note,
    };
  }

  private directToolCallResult(
    fastPath: DiscoveredTool | undefined,
    singleStrongMatch: DiscoveredTool | null,
    requestedCapability: RequestedCapability,
  ): LlmPlanResult | null {
    if (fastPath) {
      return this.singleToolResult(
        fastPath,
        requestedCapability.entities,
        "Matched the request directly to a read-only component action.",
      );
    }

    if (
      singleStrongMatch &&
      resolveArgsFromEntities(singleStrongMatch.entry, requestedCapability.entities)
        .satisfied
    ) {
      return this.singleToolResult(
        singleStrongMatch,
        requestedCapability.entities,
        `Matched the request to ${singleStrongMatch.entry.server.name}. Fill in the required inputs, then approve.`,
      );
    }

    return null;
  }

  private buildSystemPrompt(servers: McpServerType[]): string {
    const connectedComponents = servers.map((server) => server.name).join(", ");

    return `${PLANNING_PROMPTS.SYSTEM} Connected components in this project: ${connectedComponents}. Use only the exposed tools from these components.`;
  }

  private translateLlmError(
    err: unknown,
    llmOverride: LlmOverride | undefined,
  ) {
    const errorMessage = (err as Error).message || "";

    const lowerErrorMessage = errorMessage.toLowerCase();

    const missingLlmKey =
      errorMessage.includes("OPENAI_API_KEY") ||
      errorMessage.includes("OPENROUTER_API_KEY");

    if (missingLlmKey) {
      return new BadRequestError(
        "This request needs the plain-language planner, and no LLM is configured for this instance. Set one up with PUT /api/v1/llm-settings, or ask whoever runs this instance to set OPENAI_API_KEY or OPENROUTER_API_KEY in subgrid/.env.",
        { code: "missing-llm-key" },
      );
    }

    const rejectedCredential =
      ["401", "invalid_api_key", "provider returned error"].find((keyword) =>
        lowerErrorMessage.includes(keyword),
      ) !== undefined;

    if (rejectedCredential) {
      return new BadRequestError(
        llmOverride
          ? "The configured LLM key was rejected by the provider. Update it with PUT /api/v1/llm-settings."
          : "The configured LLM provider rejected its credential. Check OPENAI_API_KEY (or OPENROUTER_API_KEY if using the fallback), then restart Subgrid.",
      );
    }

    const rejectedModel =
      ["no allowed providers", "model_not_found"].find((keyword) =>
        lowerErrorMessage.includes(keyword),
      ) !== undefined;

    if (rejectedModel) {
      return new BadRequestError(
        llmOverride
          ? `The model was rejected: ${errorMessage}. This provider/key combination may not support the configured model.`
          : `The configured model was rejected: ${errorMessage}. Check OPENAI_CHAT_MODEL (or OPENROUTER_MODEL if using OpenRouter) in subgrid/.env, then restart Subgrid.`,
      );
    }

    return err instanceof Error ? err : new Error(errorMessage);
  }

  private buildWorkflowSteps(
    toolCalls: LlmToolCall[],
    toolIndex: Map<string, ToolEntry>,
    discoveredTools: DiscoveredTool[],
    message: string,
    requestedResources: string[],
    requestedCapability: RequestedCapability,
  ) {
    const planned = toolCalls
      .map((call) => {
        const entry = toolIndex.get(call.name);
        if (!entry) return null;

        const matchesRequestedResource =
          requestedResources.length === 0 ||
          resourceOverlap(message, {
            name: entry.toolName,
            description: entry.description,
            serverName: entry.server.name,
          }).length > 0;

        if (!matchesRequestedResource) return null;

        const targetMismatch =
          requestedCapability.target &&
          entry.capability.target &&
          requestedCapability.target !== entry.capability.target &&
          requestedCapability.resource !== entry.capability.resource;

        if (targetMismatch) return null;

        const readOnlyMismatch =
          isConfidentOperation(requestedCapability.operation) &&
          isReadOnlyOperation(requestedCapability.operation) !==
            entry.capability.readOnly;

        if (readOnlyMismatch) return null;

        return {
          server_id: entry.server.id,
          server_name: entry.server.name,
          tool_name: entry.toolName,
          input: call.args,
          capability: entry.capability,
          intent: entry.description,
        };
      })
      .filter((step): step is NonNullable<typeof step> => step !== null);

    return insertMissingLookups(planned, discoveredTools, message).map(
      (step, index) => ({
        ...step,
        input: stripUnavailableReferences(step.input, index + 1) as Record<
          string,
          any
        >,
      }),
    );
  }
}
