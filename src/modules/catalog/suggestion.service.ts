import { injectable } from 'tsyringe';

import { OpenAIllmProcessor } from '@/common/implementations/llm/openai';
import { McpServersRepository, ProjectsRepository } from '@/repositories';
import { NotFoundError } from '@/common/utils/errors/app.error';
import { ProjectType } from '@/models/project.model';
import { McpServerType } from '@/models/mcp-server.model';
import { BRIDGE_PRESETS, INTEGRATIONS } from './catalog.data';
import { ScoredSuggestionCandidate, SuggestionCandidate } from './catalog.types';
import {
	CAPABILITY,
	INTEGRATION_KEYWORDS,
	MAX_SUGGESTIONS,
	PRESET_KEYWORDS,
	RANKING_SYSTEM_PROMPT,
	RANKING_TIMEOUT_MS,
} from './suggestion.constants';
import { rankingSchema } from './dto/validation.dto';

@injectable()
export class SuggestionService {
	constructor(
		private readonly projectsRepository: ProjectsRepository,
		private readonly mcpServersRepository: McpServersRepository,
		private readonly llmProcessor: OpenAIllmProcessor,
	) {}

	public async suggest(projectId: string, description?: string) {
		const project = (await this.projectsRepository.getById(projectId)) as unknown as ProjectType | undefined;

		if (!project) throw new NotFoundError('Project not found');

		const text = (description ?? project.description ?? '').toLowerCase().trim();

		const dismissed = project.dismissed_suggestions || [];

		if (!text) {
			return {
				status: true,
				message: 'No description to work from',
				data: { suggestions: [], rankedBy: 'none' as const, dismissed },
			};
		}

		const connected = await this.connectedIds(projectId);
		const candidates = this.candidates();
		const scored = this.score(text, candidates, connected, new Set(dismissed));
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
			? this.finalise(fromModel!.map((pick) => pick.entry!))
			: this.finalise(scored);

		const suggestions = picked.slice(0, MAX_SUGGESTIONS).map((entry) => {
			const modelReason = useModel
				? fromModel!.find((pick) => pick.entry!.candidate.id === entry.candidate.id)?.reason
				: undefined;

			return this.toSuggestion(entry, modelReason);
		});

		return {
			status: true,
			message: 'Suggestions generated',
			data: { suggestions, rankedBy: useModel ? ('model' as const) : ('keywords' as const), dismissed },
		};
	}

	private async connectedIds(projectId: string): Promise<Set<string>> {
		const connected = new Set<string>();
		const existing = (await this.mcpServersRepository.findMany({
			project_id: projectId,
		} as Partial<McpServerType>)) as unknown as McpServerType[];

		for (const server of existing) {
			if (server.catalog_id) connected.add(server.catalog_id);
			if (server.provider) connected.add(server.provider);
		}

		return connected;
	}

	private candidates(): SuggestionCandidate[] {
		return [
			...INTEGRATIONS.filter((entry) => INTEGRATION_KEYWORDS[entry.id]?.length).map((entry) => ({
				id: entry.id,
				name: entry.name,
				description: entry.description,
				category: entry.category,
				kind: 'integration' as const,
				provider: entry.id,
				capability: CAPABILITY[entry.id] || entry.id,
				keywords: INTEGRATION_KEYWORDS[entry.id],
			})),
			...BRIDGE_PRESETS.filter((preset) => PRESET_KEYWORDS[preset.id]?.length).map((preset) => ({
				id: preset.id,
				name: preset.name,
				description: preset.description,
				category: preset.category,
				kind: 'preset' as const,
				provider: preset.provider,
				capability: CAPABILITY[preset.id] || preset.id,
				keywords: PRESET_KEYWORDS[preset.id],
			})),
		];
	}

	private score(
		text: string,
		candidates: SuggestionCandidate[],
		connected: Set<string>,
		dismissed: Set<string>,
	): ScoredSuggestionCandidate[] {
		return candidates
			.map((candidate) => {
				const matched = candidate.keywords.filter((keyword) => text.includes(keyword));

				return { candidate, matched, score: matched.length };
			})
			.filter((entry) => entry.score > 0)
			.filter((entry) => !connected.has(entry.candidate.id) && !connected.has(entry.candidate.provider))
			.filter((entry) => !dismissed.has(entry.candidate.id))
			.sort((a, b) => b.score - a.score);
	}

	private async rankWithModel(text: string, scored: ScoredSuggestionCandidate[]) {
		if (!scored.length) return null;

		const catalog = scored
			.map((entry) => `- ${entry.candidate.id} [${entry.candidate.category}] ${entry.candidate.name}: ${entry.candidate.description}`)
			.join('\n');

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

	private finalise(entries: ScoredSuggestionCandidate[]): ScoredSuggestionCandidate[] {
		const seenCapabilities = new Set<string>();

		return entries.filter((entry) => {
			if (seenCapabilities.has(entry.candidate.capability)) return false;

			seenCapabilities.add(entry.candidate.capability);

			return true;
		});
	}

	private toSuggestion(entry: ScoredSuggestionCandidate, modelReason?: string) {
		const keywordReason = entry.matched.length
			? `matched ${entry.matched.map((word) => `"${word}"`).join(', ')}`
			: 'suggested for this description';

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
