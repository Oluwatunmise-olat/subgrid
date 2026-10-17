export type StructuredResultSuggestion = {
  id: string;
  label: string;
  request: string;
  reason: string;
  risk: "read" | "write" | "destructive";
};

export type StructuredResult = {
  kind: "text" | "research" | "error";
  title: string;
  summary: string;
  sources?: { title: string; url: string; text: string }[];
  suggestions?: StructuredResultSuggestion[];
  raw: string;
};
