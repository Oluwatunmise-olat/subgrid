export const INTEGRATION_KEYWORDS: Record<string, string[]> = {
	resend: ['email', 'mail', 'transactional', 'receipt', 'receipts', 'newsletter', 'smtp', 'notifications', 'notify'],
	'resend-oauth': ['email', 'mail', 'transactional', 'receipt'],
	'cloudflare-full': ['cloudflare', 'dns', 'domain', 'edge', 'cdn', 'worker', 'workers', 'waf', 'static site'],
	sanity: ['content', 'cms', 'blog', 'editorial', 'dataset', 'media library', 'headless cms'],
	posthog: ['posthog', 'analytics', 'product analytics', 'events', 'feature flag', 'feature flags', 'funnel', 'funnels', 'insights', 'hogql', 'a/b test', 'experiment', 'experiments'],
};

export const PRESET_KEYWORDS: Record<string, string[]> = {
	contabo: ['contabo', 'vps', 'vm', 'virtual machine', 'server'],
	'cloudflare-dns': ['dns', 'domain', 'subdomain', 'nameserver', 'cname', 'mx record', 'zone', 'records'],
	'godaddy-dns': ['godaddy', 'registrar', 'buy a domain', 'buy domain', 'register domain', 'domains'],
	zeptomail: ['zeptomail', 'zepto', 'zoho mail', 'transactional email'],
	vercel: ['vercel', 'frontend', 'front-end', 'ui is on', 'web app', 'static site', 'hosting'],
	postmark: ['inbound', 'inbound email', 'incoming mail', 'postmark', 'parse email', 'email parsing'],
	coolify: ['coolify', 'deploy', 'self-hosted', 'vps', 'server management'],
	'cloudflare-r2-s3': ['r2', 's3', 'bucket', 'buckets', 'object storage', 'backup', 'backups', 'storage', 'file uploads', 'uploads'],
};

export const CAPABILITY: Record<string, string> = {
	resend: 'send-email',
	'resend-oauth': 'send-email',
	postmark: 'receive-email',
	'godaddy-dns': 'dns',
	'cloudflare-r2-s3': 'object-storage',
	'cloudflare-full': 'edge-platform',
	'cloudflare-dns': 'edge-platform',
	coolify: 'deploy-control',
	contabo: 'compute',
	vercel: 'frontend-hosting',
	zeptomail: 'send-email-alt',
	sanity: 'content',
	posthog: 'product-analytics',
};

export const MAX_SUGGESTIONS = 10;

export const RANKING_TIMEOUT_MS = 8_000;

export const RANKING_SYSTEM_PROMPT = `You choose which components a software project should connect, from a fixed catalog.

Rules:
- Only use ids that appear in the catalog below. Never invent an id.
- Return at most 4, best first.
- Include a component only when the description clearly implies it.
- If nothing in the catalog fits, return an empty list.
- "reason" is a short phrase, under 8 words, quoting what justified the choice.

Reply with JSON only:
{"components":[{"id":"the-catalog-id","reason":"why"}]}`;
