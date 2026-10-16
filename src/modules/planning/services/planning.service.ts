import { injectable } from "tsyringe";

import { McpServersRepository } from "@/repositories";
import { McpServerType } from "@/models/mcp-server.model";
import { BadRequestError } from "@/common/utils/errors/app.error";
import { OpenAIllmProcessor } from "@/common/implementations/llm/openai";
import { PLANNING_PROMPTS } from "../prompts";
import { mentionsComponent } from "@/common/utils/component-match";
import { getCachedToolManifest } from "./tool-manifest-cache";
import { LlmToolSpec, ToolEntry } from "../types/planning.types";
import {
  inferRequestCapability,
  isConfidentOperation,
  isReadOnlyOperation,
} from "./tool-capability";
import { WorkflowRuntimeService } from "@/modules/workflows/services/workflow-runtime.service";
import { stripUnavailableReferences } from "@/modules/workflows/services/step-input";
import { insertMissingLookups } from "./lookup-insertion";
import { budgetTools } from "./tool-budget";
import {
  OPERATIONAL_INTENT,
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
} from "./tool-ranking";

@injectable()
export class PlanningService {
  constructor(
    private readonly mcpServersRepository: McpServersRepository,
    private readonly openAIllmProcessor: OpenAIllmProcessor,
    private readonly workflowRuntimeService: WorkflowRuntimeService,
  ) {}

  public async plan(
    projectId: string,
    message: string,
    history: { role: "user" | "assistant"; content: string }[] = [],
  ) {
    const servers = (await this.mcpServersRepository.findMany({
      project_id: projectId,
    } as Partial<McpServerType>)) as unknown as McpServerType[];

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

    const toolIndex = new Map<string, ToolEntry>();
    const discoveredTools: Array<{
      callName: string;
      entry: ToolEntry;
      spec: LlmToolSpec;
      score: number;
    }> = [];
    const unreachable: string[] = [];

    const manifests = await Promise.all(
      servers.map(async (server, serverIndex) => {
        try {
          const tools = await getCachedToolManifest(server);
          return tools.map((tool, toolIndex) => {
            const callName = `s${serverIndex}_t${toolIndex}`;
            const entry: ToolEntry = {
              server,
              toolName: tool.toolName,
              description: tool.description,
              schema: tool.schema,
              capability: tool.capability,
            };
            return {
              callName,
              entry,
              spec: {
                name: callName,
                description: `[${server.name}] ${tool.toolName} - ${tool.description} Capability: ${tool.capability.resource}/${tool.capability.operation}${tool.capability.target ? `/${tool.capability.target}` : ""}. Required inputs: ${tool.capability.requiredInputs.join(", ") || "none"}.`,
                schema: tool.schema,
              },
              score: relevanceScore(message, {
                name: tool.toolName,
                description: tool.description,
                serverName: server.name,
              }),
            };
          });
        } catch {
          unreachable.push(server.name);
          return [];
        }
      }),
    );

    for (const tool of manifests.flat()) discoveredTools.push(tool);

    const requestedResources = resourceTokens(message);
    const requestedCapability = inferRequestCapability(message);
    const operationalRequest = OPERATIONAL_INTENT.some((term) =>
      message.toLowerCase().includes(term),
    );

    const mentionedServerIds = new Set(
      servers
        .filter((server) => mentionsComponent(message, server.name))
        .map((server) => server.id),
    );
    const docOrOps =
      operationalRequest && !isDocumentationRequest(message)
        ? discoveredTools.filter(
            (tool) => !isDocumentationTool(tool.entry.toolName),
          )
        : discoveredTools;
    const serverScoped = mentionedServerIds.size
      ? docOrOps.filter((tool) => mentionedServerIds.has(tool.entry.server.id))
      : [];
    const usableTools = serverScoped.length ? serverScoped : docOrOps;
    const resourceMatchedTools = usableTools.filter(
      (tool) =>
        resourceOverlap(message, {
          name: tool.entry.toolName,
          description: tool.entry.description,
          serverName: tool.entry.server.name,
        }).length > 0,
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
    const capabilityCandidates = resourceCandidates
      .map((tool) => ({
        ...tool,
        capabilityScore: capabilityScore(requestedCapability, tool.entry),
      }))
      .filter((tool) => tool.capabilityScore >= 0);
    const scopedResourceCandidates =
      capabilityCandidates.length > 0
        ? capabilityCandidates
        : resourceCandidates.map((tool) => ({ ...tool, capabilityScore: 0 }));
    const actionMatchedTools = scopedResourceCandidates.filter(
      (tool) => actionOverlap(message, tool.entry.toolName).length > 0,
    );
    const candidateTools =
      actionMatchedTools.length > 0
        ? actionMatchedTools
        : scopedResourceCandidates;
    const relevantTools = budgetTools(
      candidateTools.some((tool) => tool.score > 0)
        ? candidateTools
            .filter((tool) => tool.score > 0)
            .sort((a, b) => b.score - a.score)
        : discoveredTools,
    );
    const llmTools = relevantTools.map((tool) => {
      toolIndex.set(tool.callName, tool.entry);
      return tool.spec;
    });

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

    const strongMatches = fastPath
      ? []
      : relevantTools.filter(
          (tool) => capabilityScore(requestedCapability, tool.entry) >= 30,
        );
    const singleStrongMatch =
      strongMatches.length === 1 ? strongMatches[0] : null;

    let result;

    try {
      result = fastPath
        ? {
            toolCalls: [
              {
                name: fastPath.callName,
                args: resolveArgsFromEntities(
                  fastPath.entry,
                  requestedCapability.entities,
                ).args,
              },
            ],
            text: "Matched the request directly to a read-only component action.",
          }
        : singleStrongMatch
          ? {
              toolCalls: [
                {
                  name: singleStrongMatch.callName,
                  args: resolveArgsFromEntities(
                    singleStrongMatch.entry,
                    requestedCapability.entities,
                  ).args,
                },
              ],
              text: `Matched the request to ${singleStrongMatch.entry.server.name}. Fill in the required inputs, then approve.`,
            }
          : await this.openAIllmProcessor.planWithTools(
              `${PLANNING_PROMPTS.SYSTEM} Connected components in this project: ${servers.map((server) => server.name).join(", ")}. Use only the exposed tools from these components.`,
              [...history, { role: "user", content: message }],
              llmTools,
            );
    } catch (err) {
      const errorMessage = (err as Error).message || "";
      if (
        errorMessage.includes("OPENAI_API_KEY") ||
        errorMessage.includes("OPENROUTER_API_KEY")
      ) {
        throw new BadRequestError(
          "No LLM configured yet - set OPENAI_API_KEY or OPENROUTER_API_KEY in subgrid/.env to enable planning.",
        );
      }
      if (/401|invalid_api_key|provider returned error/i.test(errorMessage)) {
        throw new BadRequestError(
          "The configured LLM provider rejected its credential. Check OPENAI_API_KEY (or OPENROUTER_API_KEY if using the fallback), then restart Subgrid.",
        );
      }
      if (/no allowed providers|model_not_found/i.test(errorMessage)) {
        throw new BadRequestError(
          `The configured model was rejected: ${errorMessage}. Check OPENAI_CHAT_MODEL (or OPENROUTER_MODEL if using OpenRouter) in subgrid/.env, then restart Subgrid.`,
        );
      }
      throw err;
    }

    if (!result.toolCalls.length) {
      const fallback = strongMatches[0] || null;

      if (fallback) {
        result = {
          toolCalls: [
            {
              name: fallback.callName,
              args: resolveArgsFromEntities(
                fallback.entry,
                requestedCapability.entities,
              ).args,
            },
          ],
          text: `Matched the request to ${fallback.entry.server.name}. Fill in the required inputs, then approve.`,
        };
      }
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

    const planned = result.toolCalls
      .map((call) => {
        const entry = toolIndex.get(call.name);
        if (!entry) return null;

        if (
          requestedResources.length > 0 &&
          resourceOverlap(message, {
            name: entry.toolName,
            description: entry.description,
            serverName: entry.server.name,
          }).length === 0
        )
          return null;

        if (
          requestedCapability.target &&
          entry.capability.target &&
          requestedCapability.target !== entry.capability.target &&
          requestedCapability.resource !== entry.capability.resource
        )
          return null;

        if (
          isConfidentOperation(requestedCapability.operation) &&
          isReadOnlyOperation(requestedCapability.operation) !==
            entry.capability.readOnly
        )
          return null;

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

    const steps = insertMissingLookups(planned, discoveredTools, message).map((step, index) => ({
      ...step,
      input: stripUnavailableReferences(step.input, index + 1) as Record<string, any>,
    }));

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
}
