export const BUCKET_PATTERN = /\bbucket(?:s)?\s+(?:named|called)?\s*["']?([a-z0-9][a-z0-9.-]{1,61}[a-z0-9])["']?/i;
export const DOMAIN_PATTERN = /\b([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.[a-z]{2,})\b/i;
export const EMAIL_PATTERN = /\b([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})\b/i;
export const PROJECT_PATTERN = /\b(?:project|app|deployment)\s+(?:named|called)?\s*["']?([a-z0-9][a-z0-9-]{1,61}[a-z0-9])["']?/i;
export const RECORD_PATTERN = /\brecord\s+(?:named|called)?\s*["']?([a-z0-9][a-z0-9.-]{1,61}[a-z0-9])["']?/i;
