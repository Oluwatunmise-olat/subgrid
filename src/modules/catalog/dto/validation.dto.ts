import { z } from 'zod';

export const rankingSchema = z.object({
	components: z
		.array(
			z.object({
				id: z.string(),
				reason: z.string().optional(),
			}),
		)
		.default([]),
});
