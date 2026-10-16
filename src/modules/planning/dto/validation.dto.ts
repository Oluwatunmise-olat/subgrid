import { z } from 'zod';

export const createPlanSchema = z.object({
	message: z.string().min(1),
	history: z
		.array(
			z.object({
				role: z.enum(['user', 'assistant']),
				content: z.string(),
			}),
		)
		.max(20)
		.optional(),
});

export type CreatePlanDto = z.infer<typeof createPlanSchema>;
