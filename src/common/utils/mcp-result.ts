export interface NormalizedMcpResult {
	content: unknown[];
	structuredContent?: unknown;
	text: string;
	data: unknown;
	isError: boolean;
}

export const normalizeMcpResult = (result: any): NormalizedMcpResult => {
	const content = Array.isArray(result?.content) ? result.content : [];
	const text = content
		.map((part: any) => typeof part?.text === 'string' ? part.text : '')
		.filter(Boolean)
		.join('\n');

	return {
		content,
		structuredContent: result?.structuredContent,
		text,
		data: result?.structuredContent ?? (text || result),
		isError: result?.isError === true,
	};
};
