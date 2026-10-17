import {
  StructuredResult,
  StructuredResultSuggestion,
} from "@/common/types/orchestrator";
import {
  BRIDGE_STATUS_PATTERN,
  OUTPUT_ERROR_PATTERN,
  SUCCESS_OVERRIDE_PATTERN,
} from "@/common/constants/result-normalizer.constants";

const reportsFailureInBody = (body: string): boolean => {
  const trimmed = body.trim();

  if (!trimmed.startsWith("{")) return false;

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;

    if (parsed.success === false) return true;

    return Array.isArray(parsed.errors) && parsed.errors.length > 0;
  } catch {
    return false;
  }
};

export const looksLikeError = (raw: string): boolean => {
  const text = raw.trim();

  if (!text) return false;

  const status = text.match(BRIDGE_STATUS_PATTERN);

  if (status) {
    if (Number(status[1]) >= 400) return true;

    const separator = text.indexOf("\n\n");

    return reportsFailureInBody(
      separator >= 0 ? text.slice(separator + 2) : "",
    );
  }

  if (SUCCESS_OVERRIDE_PATTERN.test(text)) return false;

  return OUTPUT_ERROR_PATTERN.test(text);
};

export const formatToolResult = (result: unknown): string => {
  if (result == null) return "";

  if (typeof result === "string") return result;

  if (Array.isArray((result as { content?: unknown }).content)) {
    const text = (result as { content: any[] }).content
      .map((part) => (typeof part?.text === "string" ? part.text : ""))
      .filter(Boolean)
      .join("\n");

    if (text) return text;
  }

  if ((result as { structuredContent?: unknown }).structuredContent) {
    return JSON.stringify((result as any).structuredContent, null, 2);
  }

  return JSON.stringify(result, null, 2);
};

const extractResearchSources = (raw: string) => {
  const matches = [
    ...raw.matchAll(
      /<result>\s*<url>([\s\S]*?)<\/url>\s*<title>([\s\S]*?)<\/title>\s*<text>([\s\S]*?)<\/text>\s*<\/result>/gi,
    ),
  ];

  return matches
    .map((match) => {
      const text = match[3].replace(/\s+/g, " ").trim();
      const title = match[2].trim();
      const fallbackTitle =
        text.match(/#{1,4}\s*([^#]+?)(?=\s+#|$)/)?.[1]?.trim() ||
        "Documentation";
      const isNumericTitle =
        title.length > 0 &&
        [...title].every((char) => char >= "0" && char <= "9");
      return {
        url: match[1].trim(),
        title: isNumericTitle ? fallbackTitle : title,
        text,
      };
    })
    .filter((source) => source.url && source.title)
    .slice(0, 5);
};

const suggestionsFor = (raw: string): StructuredResultSuggestion[] => {
  const lower = raw.toLowerCase();

  const make = (
    label: string,
    request: string,
    reason: string,
    risk: StructuredResultSuggestion["risk"] = "read",
  ): StructuredResultSuggestion => ({
    id: label,
    label,
    request,
    reason,
    risk,
  });

  if (lower.includes("r2") || lower.includes("bucket")) {
    return [
      make(
        "Show objects in a bucket",
        "Show objects in a bucket",
        "Inspect bucket contents",
      ),
      make(
        "Create an R2 bucket",
        "Create an R2 bucket",
        "Provision new storage",
        "write",
      ),
      make(
        "Configure an R2 binding for a Pages project",
        "Configure an R2 binding for a Pages project",
        "Wire storage into a deployment",
        "write",
      ),
    ];
  }
  if (
    lower.includes("dns") ||
    lower.includes("record") ||
    lower.includes("domain")
  ) {
    return [
      make(
        "Verify DNS propagation",
        "Verify DNS propagation",
        "Confirm the record resolves",
      ),
      make(
        "Show the current DNS records",
        "Show the current DNS records",
        "Review the zone",
      ),
      make(
        "Add another DNS record",
        "Add another DNS record",
        "Extend the zone",
        "write",
      ),
    ];
  }
  if (lower.includes("project") || lower.includes("deployment")) {
    return [
      make(
        "Inspect the production deployment",
        "Inspect the production deployment",
        "Check current state",
      ),
      make(
        "Show recent deployment activity",
        "Show recent deployment activity",
        "Review recent history",
      ),
    ];
  }
  if (lower.includes("email") || lower.includes("recipient")) {
    return [
      make(
        "Show recent delivery activity",
        "Show recent delivery activity",
        "Review delivery history",
      ),
      make(
        "Send another message",
        "Send another message",
        "Follow up",
        "write",
      ),
    ];
  }

  return [
    make(
      "Explain this result",
      "Explain this result",
      "Get a plain-language summary",
    ),
    make(
      "Show the related resource details",
      "Show the related resource details",
      "Drill into this resource",
    ),
  ];
};

export const normalizeToolResult = (result: unknown): StructuredResult => {
  const raw = formatToolResult(result);
  const failed =
    (result as { isError?: boolean })?.isError === true || looksLikeError(raw);
  const sources = extractResearchSources(raw);

  return {
    kind: failed ? "error" : sources.length > 0 ? "research" : "text",
    title: failed ? "Action ran" : "Completed action",
    summary: failed
      ? "Executed, but the response reports a failure."
      : "Completed successfully.",
    sources: sources.length > 0 ? sources : undefined,
    suggestions: failed ? undefined : suggestionsFor(raw),
    raw,
  };
};
