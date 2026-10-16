export const OUTPUT_ERROR_PATTERN =
  /(?:^|[\s"'>:.\[({-])(error|failed|failure|unauthorized|forbidden|access denied|not found)\b/i;
export const SUCCESS_OVERRIDE_PATTERN = /^\s*(no|0)\s+(error|errors|failures|issues)\b/i;

export const BRIDGE_STATUS_PATTERN = /^HTTP\s+(\d{3})\b/;
