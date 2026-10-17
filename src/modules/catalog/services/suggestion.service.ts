import { injectable } from "tsyringe";

import { OpenAIllmProcessor } from "@/common/implementations/llm/openai";
import { McpServersRepository, ProjectsRepository } from "@/repositories";
import { NotFoundError } from "@/common/utils/errors/app.error";
import { ProjectType } from "@/models/project.model";
import { McpServerType } from "@/models/mcp-server.model";
import { BRIDGE_PRESETS, INTEGRATIONS } from "@/common/utils/catalog-data";
import {
  ScoredSuggestionCandidate,
  SuggestionCandidate,
} from "@/common/types/catalog";
import {
  CAPABILITY,
  INTEGRATION_KEYWORDS,
  MAX_SUGGESTIONS,
  PRESET_KEYWORDS,
  RANKING_SYSTEM_PROMPT,
  RANKING_TIMEOUT_MS,
} from "@/common/constants/suggestion.constants";
import { rankingSchema } from "../dto/validation.dto";

@injectable()
export class SuggestionService {
  constructor(
    private readonly projectsRepository: ProjectsRepository,
    private readonly mcpServersRepository: McpServersRepository,
    private readonly llmProcessor: OpenAIllmProcessor,
  ) {}

  public async suggest(projectId: string, description?: string) {
    const project = (await this.projectsRepository.getById(
      projectId,
    )) as unknown as ProjectType;

    if (!project) throw new NotFoundError("Project not found");

    const text = (description ?? project.description ?? "").toLowerCase();

    const dismissed = project.dismissed_suggestions || [];

    if (!text) {
      return {
        status: true,
        message: "No description to work from",
        data: { suggestions: [], rankedBy: "none", dismissed },
      };
    }

    const connectedCatalogIds = await this.findConnectedCatalogIds(projectId);

    const candidates = this.catalogCandidates();

    const scored = this.rankByKeywords(
      text,
      candidates,
      connectedCatalogIds,
      new Set(dismissed),
    );

    const byId = new Map(scored.map((entry) => [entry.candidate.id, entry]));

    const choices = await this.rankWithModel(text, scored);

    const fromModel = choices
      ?.map((choice) => ({
        entry: byId.get(choice.id) as ScoredSuggestionCandidate | undefined,
        reason: choice.reason,
      }))
      .filter((pick) => pick.entry);

    const useModel = Boolean(fromModel && fromModel.length);

    const picked = useModel
      ? this.finalize(fromModel!.map((pick) => pick.entry!))
      : this.finalize(scored);

    const reasonById = new Map(
      fromModel?.map((pick) => [pick.entry!.candidate.id, pick.reason]),
    );

    const suggestions = picked
      .slice(0, MAX_SUGGESTIONS)
      .map((entry) => this.publicSuggestion(entry, reasonById.get(entry.candidate.id)));

    return {
      status: true,
      message: "Suggestions generated",
      data: {
        suggestions,
        rankedBy: useModel ? ("model" as const) : ("keywords" as const),
        dismissed,
      },
    };
  }

  private async findConnectedCatalogIds(
    projectId: string,
  ): Promise<Set<string>> {
    const connectedCatalogIds = new Set<string>();

    const existing = await this.mcpServersRepository.findMany({
      project_id: projectId,
    });

    for (const server of existing) {
      if (server.catalog_id) connectedCatalogIds.add(server.catalog_id);

      if (server.provider) connectedCatalogIds.add(server.provider);
    }

    return connectedCatalogIds;
  }

  private catalogCandidates(): SuggestionCandidate[] {
    const integrationCandidates = INTEGRATIONS.filter(
      (entry) => INTEGRATION_KEYWORDS[entry.id]?.length,
    ).map((entry) => ({
      id: entry.id,
      name: entry.name,
      description: entry.description,
      category: entry.category,
      kind: "integration" as const,
      provider: entry.id,
      capability: CAPABILITY[entry.id] || entry.id,
      keywords: INTEGRATION_KEYWORDS[entry.id],
    }));

    const presetCandidates = BRIDGE_PRESETS.filter(
      (preset) => PRESET_KEYWORDS[preset.id]?.length,
    ).map((preset) => ({
      id: preset.id,
      name: preset.name,
      description: preset.description,
      category: preset.category,
      kind: "preset" as const,
      provider: preset.provider,
      capability: CAPABILITY[preset.id] || preset.id,
      keywords: PRESET_KEYWORDS[preset.id],
    }));

    return [...integrationCandidates, ...presetCandidates];
  }

  private rankByKeywords(
    text: string,
    candidates: SuggestionCandidate[],
    connectedCatalogIds: Set<string>,
    dismissed: Set<string>,
  ): ScoredSuggestionCandidate[] {
    const ranked: ScoredSuggestionCandidate[] = [];

    for (const candidate of candidates) {
      // Skip already connected resources
      if (
        connectedCatalogIds.has(candidate.id) ||
        connectedCatalogIds.has(candidate.provider)
      ) {
        continue;
      }

      if (dismissed.has(candidate.id)) continue;

      const matched = candidate.keywords.filter((keyword) =>
        text.includes(keyword),
      );

      if (!matched.length) continue;

      ranked.push({ candidate, matched, score: matched.length });
    }

    return ranked.sort((a, b) => b.score - a.score);
  }

  private async rankWithModel(
    text: string,
    scored: ScoredSuggestionCandidate[],
  ) {
    if (!scored.length) return null;

    const catalog = scored
      .map(
        (entry) =>
          `- ${entry.candidate.id} [${entry.candidate.category}] ${entry.candidate.name}: ${entry.candidate.description}`,
      )
      .join("\n");

    try {
      const result = await this.llmProcessor.completeJson(
        RANKING_SYSTEM_PROMPT,
        `Project description:\n${text}\n\nCatalog:\n${catalog}`,
        rankingSchema,
        RANKING_TIMEOUT_MS,
      );

      return result.components;
    } catch {
      return null;
    }
  }

  private finalize(
    entries: ScoredSuggestionCandidate[],
  ): ScoredSuggestionCandidate[] {
    const seenCapabilities = new Set<string>();

    return entries.filter((entry) => {
      if (seenCapabilities.has(entry.candidate.capability)) return false;

      seenCapabilities.add(entry.candidate.capability);

      return true;
    });
  }

  private publicSuggestion(entry: ScoredSuggestionCandidate, modelReason?: string) {
    const keywordReason = entry.matched.length
      ? `matched ${entry.matched.map((word) => `"${word}"`).join(", ")}`
      : "suggested for this description";

    return {
      id: entry.candidate.id,
      name: entry.candidate.name,
      description: entry.candidate.description,
      category: entry.candidate.category,
      kind: entry.candidate.kind,
      reason: modelReason?.trim() || keywordReason,
    };
  }
}
