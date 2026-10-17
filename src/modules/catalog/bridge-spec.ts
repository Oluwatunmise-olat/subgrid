import { BRIDGE_SENTINELS } from '@/common/implementations/mcp/bridges';
import { BridgePreset } from '@/common/types/catalog';

const buildRestSpec = (preset: BridgePreset) => ({
	name: preset.id,
	base_url: preset.baseUrl,
	auth: preset.auth,
	unique_headers: preset.uniqueHeaders,
	verbs: preset.verbs,
});

const buildS3Spec = (preset: BridgePreset) => ({
	name: preset.id,
	endpoint: preset.endpoint,
	region: preset.region,
	accessKeyId: preset.accessKeyId,
	secretAccessKey: preset.secretAccessKey,
});

export const bridgeArgv = (preset: BridgePreset): string[] => {
	const sentinel = {
		rest: BRIDGE_SENTINELS.http,
		s3: BRIDGE_SENTINELS.s3,
	}[preset.kind];

	const spec = preset.kind === 'rest' ? buildRestSpec(preset) : buildS3Spec(preset);

	return [sentinel, JSON.stringify(spec)];
};

export const displayAuthority = (preset: BridgePreset): string =>
	preset.kind === 'rest' ? preset.baseUrl || '' : 'your S3 endpoint';
