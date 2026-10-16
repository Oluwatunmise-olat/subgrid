import { ToolCapability } from "@/modules/planning/types/planning.types";

export type PlannedStep = {
  serverId: string;
  toolName: string;
  input: Record<string, any>;
  capability: ToolCapability;
  title?: string;
  intent?: string;
};
