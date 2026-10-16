import { referencedStepIndexes } from "@/modules/workflows/services/step-input";
import type { LookupStep, LookupTool } from "../types/planning.types";
import { FILTER_PARAMS, ID_FIELD, ID_INPUT, READ_TOOL } from "@/common/constants/lookup-insertion.constants";

const hostnameIn = (message: string): string | null =>
	(message.match(/\b[a-z0-9-]+(?:\.[a-z0-9-]+)+\b/i) || [])[0] || null;

const declaredInputs = (tool: LookupTool): string[] => {
	const required = tool.entry.schema?.required;

	if (Array.isArray(required) && required.length) return required;

	return Object.keys(tool.entry.schema?.properties || {});
};

const resourceOf = (inputName: string) =>
	inputName.replace(ID_INPUT, "").replace(/_/g, "").toLowerCase();

const producesId = (tool: LookupTool, inputName: string) => {
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
	const hostname = hostnameIn(message);
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

			const placed = output.findIndex(
				(existing) =>
					existing.server_id === producer.entry.server.id &&
					existing.tool_name === producer.entry.toolName,
			);

			let position = placed;

			if (position < 0) {
				const filterParam = filterParamFor(producer);
				const args: Record<string, any> = {};

				if (filterParam && hostname) args[filterParam] = hostname;

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

			input[name] = `{{step${position + 1}.${ID_FIELD}}}`;
		}

		output.push({ ...step, input });
	}

	return output;
};
