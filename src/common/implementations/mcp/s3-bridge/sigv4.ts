import { createHash, createHmac } from 'node:crypto';

export type SigV4Input = {
	method: string;
	url: URL;
	payload?: Buffer;
	region: string;
	service?: string;
	accessKeyId: string;
	secretAccessKey: string;
	extraHeaders?: Record<string, string>;
	timestamp?: Date;
};

const DEFAULT_SERVICE = 's3';

const hex = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');

const hmac = (key: Buffer | string, data: string) => createHmac('sha256', key).update(data).digest();

const rfc3986 = (value: string) =>
	encodeURIComponent(value).replace(/[!'()*]/g, (char) => '%' + char.charCodeAt(0).toString(16).toUpperCase());

export const canonicalUri = (path: string) => path.split('/').map(rfc3986).join('/');

export const amzDateOf = (timestamp: Date) =>
	timestamp.toISOString().replace(/[:-]|\.\d{3}/g, '');

export const signRequest = (input: SigV4Input) => {
	const service = input.service || DEFAULT_SERVICE;
	const payload = input.payload ?? Buffer.alloc(0);
	const payloadHash = hex(payload);

	const timestamp = input.timestamp ?? new Date();
	const amzDate = amzDateOf(timestamp);
	const dateStamp = amzDate.slice(0, 8);

	const headers: Record<string, string> = {
		host: input.url.host,
		'x-amz-content-sha256': payloadHash,
		'x-amz-date': amzDate,
		...input.extraHeaders,
	};

	const signedHeaderNames = Object.keys(headers)
		.map((name) => name.toLowerCase())
		.sort();
	const canonicalHeaders = signedHeaderNames.map((name) => `${name}:${headers[name].trim()}\n`).join('');
	const signedHeaders = signedHeaderNames.join(';');

	const pairs = [...input.url.searchParams.entries()]
		.map(([key, value]) => [rfc3986(key), rfc3986(value)] as const)
		.sort((a, b) => (a[0] === b[0] ? (a[1] < b[1] ? -1 : 1) : a[0] < b[0] ? -1 : 1));
	const canonicalQuery = pairs.map(([key, value]) => `${key}=${value}`).join('&');

	const canonicalRequest = [
		input.method,
		canonicalUri(input.url.pathname),
		canonicalQuery,
		canonicalHeaders,
		signedHeaders,
		payloadHash,
	].join('\n');

	const scope = `${dateStamp}/${input.region}/${service}/aws4_request`;
	const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, hex(canonicalRequest)].join('\n');

	const signingKey = hmac(
		hmac(hmac(hmac(`AWS4${input.secretAccessKey}`, dateStamp), input.region), service),
		'aws4_request',
	);
	const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');

	return {
		signature,
		signedHeaders,
		canonicalRequest,
		stringToSign,
		authorization: `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
		headers,
	};
};
