import { z } from 'zod';

export const callToolSchema = z.object({
	tool_name: z.string().min(1),
	input: z.record(z.any()).default({}),
	approved: z.boolean().optional(),
});

export type CallToolDto = z.infer<typeof callToolSchema>;
