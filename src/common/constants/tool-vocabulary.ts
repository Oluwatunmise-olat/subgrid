import { RequestEntities } from "@/common/types/entities";

export const WRITE_OPERATIONS = [
  "delete",
  "remove",
  "destroy",
  "revoke",
  "purge",
  "update",
  "edit",
  "modify",
  "configure",
  "create",
  "add",
  "provision",
  "send",
  "deploy",
  "promote",
  "invite",
  "publish",
  "upload",
  "grant",
  "point",
  "set",
  "change",
  "rename",
  "assign",
  "attach",
  "enable",
  "disable",
];

export const READ_OPERATIONS = [
  "list",
  "get",
  "read",
  "describe",
  "search",
  "fetch",
  "check",
  "inspect",
  "status",
  "browse",
  "enumerate",
  "verify",
  "find",
];

export const WRITE_OPERATION_FAMILIES: Record<string, string> = {
  delete: "delete",
  remove: "delete",
  destroy: "delete",
  revoke: "delete",
  purge: "delete",
  update: "update",
  edit: "update",
  modify: "update",
  configure: "update",
  set: "update",
  change: "update",
  rename: "update",
  assign: "update",
  attach: "update",
  point: "update",
  enable: "update",
  disable: "update",
  create: "create",
  add: "create",
  provision: "create",
  send: "send",
  deploy: "send",
  promote: "send",
  invite: "send",
  publish: "send",
  upload: "send",
  grant: "send",
};

export const TARGET_KEYWORDS: Array<[string, string[]]> = [
  ["objects", ["object", "objects", "file", "files", "content", "contents"]],
  ["buckets", ["bucket", "buckets"]],
  ["records", ["record", "records", "dns", "zone", "zones"]],
  ["domains", ["domain", "domains", "project", "projects", "deployment", "deployments"]],
  ["messages", ["message", "messages", "email", "emails", "mail"]],
  ["servers", ["server", "servers", "service", "services", "instance", "instances"]],
];

export const STORAGE_KEYWORDS = ["s3", "r2", "storage", "bucket", "object"];
export const DNS_KEYWORDS = ["dns", "domain", "record", "zone"];
export const EMAIL_KEYWORDS = ["email", "mail", "message"];

export const DOCUMENTATION_TOOLS = [
  "docs",
  "documentation",
  "search_docs",
  "find_docs",
  "web_search",
];

export const DOCUMENTATION_INTENT = [
  "docs",
  "documentation",
  "document",
  "guide",
  "reference",
  "explain",
  "research",
  "how does",
  "how do",
];

export const OPERATIONAL_INTENT = [
  "list",
  "show",
  "get",
  "create",
  "add",
  "update",
  "configure",
  "connect",
  "delete",
  "remove",
  "send",
  "deploy",
  "run",
];

export const ROUTING_STOPWORDS = [
  "a",
  "an",
  "and",
  "do",
  "for",
  "i",
  "me",
  "my",
  "of",
  "please",
  "the",
  "to",
  "with",
  "want",
  "can",
  "you",
  "how",
  "what",
  "which",
  "when",
  "where",
  "many",
  "much",
  "each",
];

export const ENTITY_ARG_ALIASES: Record<keyof RequestEntities, string[]> = {
  bucket: ["bucket", "Bucket", "bucket_name", "BucketName"],
  domain: ["domain", "Domain", "domain_name"],
  zone: ["zone", "Zone", "zone_id", "ZoneId", "zone_name"],
  recipient: ["to", "recipient", "email", "To", "Recipient"],
  project: ["project", "Project", "project_name", "app", "App"],
  record: ["record", "Record", "name", "Name", "record_name"],
};
