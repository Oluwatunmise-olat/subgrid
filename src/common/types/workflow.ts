import { ToolCapability } from "@/common/types/planning";

export type PlannedStep = {
  serverId: string;
  toolName: string;
  input: Record<string, any>;
  capability: ToolCapability;
  title?: string;
  intent?: string;
};
