import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { canonicalUri, signRequest } from "./sigv4";
import {
  DEFAULT_REGION,
  REQUEST_TIMEOUT_MS,
  MAX_INLINE_BYTES,
} from "./constants";
import { S3Spec, S3Result } from "@/common/types/s3-bridge";
import { interpolateEnv } from "@/common/utils/interpolate-env";

const readSpec = (): S3Spec => {
  const fromArgv = process.argv[2];
  const argvLooksLikeJson =
    Boolean(fromArgv) && fromArgv.trim().startsWith("{");
  const raw = argvLooksLikeJson ? fromArgv : process.env.SUBGRID_S3_SPEC;

  if (!raw) {
    throw new Error("No spec: pass it as an argument, or set SUBGRID_S3_SPEC");
  }

  const parsed = JSON.parse(raw) as S3Spec;

  return {
    name: parsed.name,
    endpoint: interpolateEnv(parsed.endpoint),
    region: interpolateEnv(parsed.region || DEFAULT_REGION),
    accessKeyId: interpolateEnv(parsed.accessKeyId || ""),
    secretAccessKey: interpolateEnv(parsed.secretAccessKey || ""),
  };
};

const spec = readSpec();

if (!spec.endpoint || !spec.accessKeyId || !spec.secretAccessKey) {
  throw new Error("Spec needs endpoint, accessKeyId and secretAccessKey");
}

const endpoint = new URL(spec.endpoint);
const endpointOrigin = endpoint.origin;

const SAFE_BUCKET = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;

const assertBucket = (bucket: unknown) => {
  const value = String(bucket ?? "");
  if (!SAFE_BUCKET.test(value))
    throw new Error(
      `Refusing bucket ${JSON.stringify(value)}: not a valid bucket name`,
    );
  return value;
};

const hasControlCharacters = (value: string): boolean => {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
};

const assertKey = (key: unknown) => {
  const value = String(key ?? "");

  if (!value) throw new Error("A key is required");

  if (hasControlCharacters(value)) {
    throw new Error("Refusing key: control characters are not allowed");
  }

  if (value.startsWith("/")) {
    throw new Error('Refusing key: must not start with "/"');
  }

  if (value.split("/").includes("..")) {
    throw new Error('Refusing key: ".." segments are not allowed');
  }

  return value;
};

const objectPath = (bucket: unknown, key: unknown) =>
  `/${assertBucket(bucket)}/${assertKey(key)}`;

const TEXTUAL_CONTENT_TYPE = /^(text\/|application\/(json|xml))/;

const formatResponseBody = (
  buffer: Buffer,
  contentType: string | null,
): string => {
  const isTextual =
    TEXTUAL_CONTENT_TYPE.test(contentType || "") || buffer.length === 0;

  if (isTextual) return buffer.toString("utf8");

  const base64Preview = buffer.subarray(0, MAX_INLINE_BYTES).toString("base64");

  return `[binary ${buffer.length} bytes, base64]\n${base64Preview}`;
};

const s3Request = async (
  method: string,
  path: string,
  query: Record<string, string | number | undefined>,
  body?: Buffer,
  contentType?: string,
): Promise<S3Result> => {
  const url = new URL(endpointOrigin + canonicalUri(path));
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "")
      url.searchParams.set(key, String(value));
  }

  if (url.origin !== endpointOrigin)
    throw new Error(`Refusing to leave ${endpointOrigin}`);

  const payload = body ?? Buffer.alloc(0);

  const extraHeaders: Record<string, string> = {};
  if (contentType) extraHeaders["content-type"] = contentType;

  const { authorization, headers } = signRequest({
    method,
    url,
    payload,
    region: spec.region!,
    accessKeyId: spec.accessKeyId,
    secretAccessKey: spec.secretAccessKey,
    extraHeaders,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let result: S3Result | undefined;
  let fetchError: unknown;

  try {
    const response = await fetch(url, {
      method,
      headers: { ...headers, authorization },
      body:
        method === "GET" || method === "HEAD"
          ? undefined
          : new Uint8Array(payload),
      redirect: "manual",
      signal: controller.signal,
    });

    const contentTypeHeader = response.headers.get("content-type");
    const buffer = Buffer.from(await response.arrayBuffer());

    result = {
      ok: response.ok,
      status: response.status,
      body: formatResponseBody(buffer, contentTypeHeader),
      contentType: contentTypeHeader,
    };
  } catch (err) {
    fetchError = err;
  }

  clearTimeout(timer);

  if (fetchError) throw fetchError;

  return result!;
};

const tools = [
  {
    name: "list_buckets",
    description: "List the buckets available to these credentials",
    inputSchema: { type: "object" as const, properties: {} },
    run: async () => s3Request("GET", "/", {}),
  },
  {
    name: "list_objects",
    description:
      "List objects in a bucket (S3 ListObjectsV2), optionally filtered by prefix",
    inputSchema: {
      type: "object" as const,
      properties: {
        bucket: { type: "string", description: "bucket name" },
        prefix: {
          type: "string",
          description: "only keys starting with this prefix",
        },
        max_keys: { type: "number", description: "page size, 1-1000" },
        continuation_token: {
          type: "string",
          description: "token from a previous page",
        },
      },
      required: ["bucket"],
    },
    run: async (args: any) =>
      s3Request("GET", `/${assertBucket(args.bucket)}`, {
        "list-type": 2,
        prefix: args.prefix,
        "max-keys": args.max_keys,
        "continuation-token": args.continuation_token,
      }),
  },
  {
    name: "head_object",
    description:
      "Object metadata (size, content type, etag) without downloading it",
    inputSchema: {
      type: "object" as const,
      properties: { bucket: { type: "string" }, key: { type: "string" } },
      required: ["bucket", "key"],
    },
    run: async (args: any) =>
      s3Request("HEAD", objectPath(args.bucket, args.key), {}),
  },
  {
    name: "get_object",
    description:
      "Read an object's contents. Binary content is returned as base64.",
    inputSchema: {
      type: "object" as const,
      properties: { bucket: { type: "string" }, key: { type: "string" } },
      required: ["bucket", "key"],
    },
    run: async (args: any) =>
      s3Request("GET", objectPath(args.bucket, args.key), {}),
  },
  {
    name: "put_object",
    description:
      "Write an object. content is utf8 unless body_encoding is base64.",
    inputSchema: {
      type: "object" as const,
      properties: {
        bucket: { type: "string" },
        key: { type: "string" },
        content: { type: "string", description: "the object body" },
        body_encoding: { type: "string", enum: ["utf8", "base64"] },
        content_type: {
          type: "string",
          description: "e.g. text/plain, image/png",
        },
      },
      required: ["bucket", "key", "content"],
    },
    run: async (args: any) => {
      const isBase64 = args.body_encoding === "base64";
      const body = Buffer.from(
        String(args.content),
        isBase64 ? "base64" : "utf8",
      );
      const defaultContentType = isBase64
        ? "application/octet-stream"
        : "text/plain; charset=utf-8";

      return s3Request(
        "PUT",
        objectPath(args.bucket, args.key),
        {},
        body,
        args.content_type || defaultContentType,
      );
    },
  },
  {
    name: "delete_object",
    description: "Delete an object",
    inputSchema: {
      type: "object" as const,
      properties: { bucket: { type: "string" }, key: { type: "string" } },
      required: ["bucket", "key"],
    },
    run: async (args: any) =>
      s3Request("DELETE", objectPath(args.bucket, args.key), {}),
  },
];

const toolsByName = new Map(tools.map((tool) => [tool.name, tool]));

const server = new Server(
  {
    name: spec.name ? `subgrid-s3:${spec.name}` : "subgrid-s3",
    version: "1.0.0",
  },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: tools.map(({ name, description, inputSchema }) => ({
    name,
    description,
    inputSchema,
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const tool = toolsByName.get(request.params.name);

  if (!tool) {
    return {
      isError: true,
      content: [
        { type: "text", text: `Unknown tool "${request.params.name}"` },
      ],
    };
  }

  try {
    const result = await tool.run((request.params.arguments || {}) as any);
    const text = [
      `HTTP ${result.status}`,
      result.contentType ? `content-type: ${result.contentType}` : "",
      "",
      result.body,
    ]
      .filter(Boolean)
      .join("\n");

    return {
      ...(result.ok ? {} : { isError: true }),
      content: [{ type: "text", text }],
    };
  } catch (err) {
    return {
      isError: true,
      content: [{ type: "text", text: (err as Error).message }],
    };
  }
});

const main = async () => {
  await server.connect(new StdioServerTransport());
};

main().catch((err) => {
  process.stderr.write(`[s3-bridge] fatal: ${(err as Error).message}\n`);
  process.exit(1);
});
