export const ID_INPUT = /(_id|_uuid)$/i;

export const READ_TOOL = /(^|_)(list|get|search|describe|find)(_|$)/i;

export const ID_FIELD = "result.0.id";

export const FILTER_PARAMS = [
  "name",
  "domain",
  "record",
  "hostname",
  "recipient",
];

export const SENTINEL_ID_VALUES = new Set([
  "latest",
  "current",
  "newest",
  "default",
  "recent",
]);
