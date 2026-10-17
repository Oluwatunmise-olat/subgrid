export const slug = (value: string) =>
	value.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').toLowerCase();
