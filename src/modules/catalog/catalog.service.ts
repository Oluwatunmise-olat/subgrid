import { injectable } from 'tsyringe';

import { BadRequestError } from '@/common/utils/errors/app.error';
import {
	BRIDGE_PRESETS,
	BridgePreset,
	CATEGORY_LABELS,
	CatalogIntegration,
	INTEGRATIONS,
} from './catalog.data';
import { ResolvedComponent } from './catalog.types';
import { bridgeArgv, displayAuthority } from './bridge-spec';

@injectable()
export class CatalogService {
	public list() {
		return {
			status: true,
			message: 'Catalog retrieved',
			data: {
				categories: CATEGORY_LABELS,
				integrations: INTEGRATIONS.map((entry) => this.publicIntegration(entry)),
				presets: BRIDGE_PRESETS.map((preset) => this.publicPreset(preset)),
			},
		};
	}

	private publicIntegration(entry: CatalogIntegration) {
		const { command, baseArgs, url, ...rest } = entry;

		return rest;
	}

	private publicPreset(preset: BridgePreset) {
		return {
			id: preset.id,
			kind: preset.kind,
			name: preset.name,
			category: preset.category,
			provider: preset.provider,
			description: preset.description,
			docs: preset.docs,
			note: preset.note,
			limits: preset.limits,
			fields: preset.fields,
			optionalFields: preset.optionalFields || [],
			verbNames: preset.verbs.map((verb) => verb.name),
			authority: displayAuthority(preset),
		};
	}

	public resolveIntegration(id: string): ResolvedComponent {
		const entry = INTEGRATIONS.find((item) => item.id === id);

		if (!entry) throw new BadRequestError(`Unknown integration "${id}"`);

		if (entry.custom) {
			return {
				transport: entry.transport || 'stdio',
				provider: id,
				category: entry.category,
				custom: true,
			};
		}

		if (entry.oauth || entry.transport === 'http' || entry.transport === 'sse') {
			return {
				transport: entry.transport || 'http',
				url: entry.url || null,
				provider: id,
				category: entry.category,
				oauth: Boolean(entry.oauth),
			};
		}

		return {
			transport: 'stdio',
			command: entry.command || null,
			args: entry.baseArgs || [],
			provider: id,
			category: entry.category,
		};
	}

	public verbRequiresApproval(catalogId: string | null, toolName: string): boolean {
		if (!catalogId) return false;

		const preset = BRIDGE_PRESETS.find((item) => item.id === catalogId);

		if (!preset) return false;

		const slug = (value: string) =>
			value.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').toLowerCase();

		return preset.verbs.some(
			(verb) => slug(verb.name) === toolName && Boolean((verb as { requiresApproval?: boolean }).requiresApproval),
		);
	}

	public resolvePreset(id: string): ResolvedComponent {
		const preset = BRIDGE_PRESETS.find((item) => item.id === id);

		if (!preset) throw new BadRequestError(`Unknown preset "${id}"`);

		return {
			transport: 'stdio',
			command: 'bun',
			args: bridgeArgv(preset),
			provider: preset.provider,
			category: preset.category,
		};
	}

	public resolveById(id: string): ResolvedComponent | null {
		try {
			return this.resolvePreset(id);
		} catch {
			try {
				return this.resolveIntegration(id);
			} catch {
				return null;
			}
		}
	}
}
