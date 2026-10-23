import { referencedStepIndexes } from "@/common/utils/step-input";
import type { LookupStep, LookupTool } from "@/common/types/planning";
import {
  FILTER_PARAMS,
  ID_FIELD,
  ID_INPUT,
  READ_TOOL,
} from "@/common/constants/lookup-insertion.constants";

export const namedResourceIn = (message: string): string | null => {
  // matches version strings ("v18.20.8"), IP addresses ("192.168.1.1"), hyphen words ("end-to-end"), "trysubgrid.com"
  const NAMED_RESOURCE_PATTERNS = [
    /\b[a-z0-9-]+(?:\.[a-z0-9-]+)+\b/i, // e.g. ""trysubgrid.com"
    /\b[a-z0-9]+(?:-[a-z0-9]+){2,}\b/i, // e.g. ""trysubgrid-app-production"
  ];

  for (const pattern of NAMED_RESOURCE_PATTERNS) {
    const match = message.match(pattern);
    if (match) return match[0];
  }

  return null;
};

export const declaredInputs = (tool: LookupTool): string[] =>
  Object.keys(tool.entry.schema?.properties || {});

export const resourceOf = (inputName: string) =>
  inputName.replace(ID_INPUT, "").replace(/_/g, "").toLowerCase();

export const producesId = (tool: LookupTool, inputName: string) => {
  const name = tool.entry.toolName.toLowerCase();

  return READ_TOOL.test(name) && name.includes(resourceOf(inputName));
};

const filterParamFor = (tool: LookupTool): string | null => {
  const properties = tool.entry.schema?.properties || {};

  return FILTER_PARAMS.find((candidate) => candidate in properties) || null;
};

const isFilled = (value: unknown) =>
  value !== undefined &&
  value !== null &&
  value !== "" &&
  referencedStepIndexes(value).length === 0;

export const insertMissingLookups = <T extends LookupStep>(
  steps: T[],
  tools: ReadonlyArray<LookupTool>,
  message: string,
): T[] => {
  const named = namedResourceIn(message);
  const output: T[] = [];

  for (const step of steps) {
    const tool = tools.find(
      (candidate) =>
        candidate.entry.server.id === step.server_id &&
        candidate.entry.toolName === step.tool_name,
    );

    if (!tool) {
      output.push(step);
      continue;
    }

    const input: Record<string, any> = { ...step.input };

    for (const name of declaredInputs(tool)) {
      if (isFilled(input[name]) || !ID_INPUT.test(name)) continue;

      const producer = tools.find(
        (candidate) =>
          candidate.entry.server.id === step.server_id &&
          producesId(candidate, name),
      );

      if (!producer) continue;

      const filterParam = filterParamFor(producer);

      const canFilterServerSide = Boolean(filterParam && named);
      const canMatchByName = Boolean(named && !canFilterServerSide);

      const placed = output.findIndex(
        (existing) =>
          existing.server_id === producer.entry.server.id &&
          existing.tool_name === producer.entry.toolName,
      );

      let position = placed;

      if (position < 0) {
        const args: Record<string, any> = {};

        if (canFilterServerSide) args[filterParam!] = named;

        output.push({
          server_id: producer.entry.server.id,
          server_name: producer.entry.server.name,
          tool_name: producer.entry.toolName,
          input: args,
          capability: producer.entry.capability,
          intent: `Find the ${resourceOf(name)} the request named`,
        } as T);

        position = output.length - 1;
      }

      if (canFilterServerSide) {
        input[name] = `{{step${position + 1}.${ID_FIELD}}}`;
      } else if (canMatchByName) {
        input[name] = `{{step${position + 1}.result[*=${named}].${name}}}`;
      } else {
        input[name] = `{{select:step${position + 1}}}`;
      }
    }

    output.push({ ...step, input });
  }

  return output;
};
