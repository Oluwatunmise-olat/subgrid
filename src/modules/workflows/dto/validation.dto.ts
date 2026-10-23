import { z } from 'zod';

const capabilitySchema = z.object({
	resource: z.string(),
	operation: z.string(),
	target: z.string().nullable(),
	readOnly: z.boolean(),
	requiredInputs: z.array(z.string()),
});

export const updateWorkflowSchema = z.object({
	executionMode: z.enum(['sequential', 'parallel']).optional(),
	updateSteps: z
		.array(
			z.object({
				id: z.string(),
				input: z.record(z.any()),
			}),
		)
		.optional(),
	removeStepIds: z.array(z.string()).optional(),
	reorder: z.array(z.string()).optional(),
	addStep: z
		.object({
			serverId: z.string(),
			toolName: z.string(),
			input: z.record(z.any()).optional(),
			title: z.string().optional(),
			intent: z.string().optional(),
			capability: capabilitySchema,
		})
		.optional(),
});

export type UpdateWorkflowDto = z.infer<typeof updateWorkflowSchema>;

export const retryStepSchema = z
	.object({
		allowAlways: z.boolean().optional(),
	})
	.default({});

export type RetryStepDto = z.infer<typeof retryStepSchema>;

export const selectStepOptionSchema = z.object({
	value: z.string(),
});

export type SelectStepOptionDto = z.infer<typeof selectStepOptionSchema>;
