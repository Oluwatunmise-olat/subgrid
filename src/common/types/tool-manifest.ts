import { CachedToolEntry } from "@/common/types/planning";

export type CacheEntry = {
  tools: CachedToolEntry[];
  expiresAt: number;
  lastGoodAt: number;
  staleSince: number | null;
  lastError: string | null;
  nextAttemptAt: number;
};

export type ToolManifestMeta = {
  stale: boolean;
  staleSince: number | null;
  lastGoodAt: number | null;
  lastError: string | null;
};
