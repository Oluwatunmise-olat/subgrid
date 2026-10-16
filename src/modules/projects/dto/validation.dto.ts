import { z } from 'zod';

export const createProjectSchema = z.object({
	name: z.string().min(1),
	slug: z
		.string()
		.min(1)
		.regex(/^[a-z0-9-]+$/, 'slug must be lowercase alphanumeric with dashes'),
	description: z.string().max(2000).optional(),
});

export const updateProjectSchema = createProjectSchema.partial().extend({
	dismissed_suggestions: z.array(z.string()).optional(),
});

export const suggestComponentsSchema = z.object({
	description: z.string().max(2000).optional(),
});

export type CreateProjectDto = z.infer<typeof createProjectSchema>;
export type UpdateProjectDto = z.infer<typeof updateProjectSchema>;
export type SuggestComponentsDto = z.infer<typeof suggestComponentsSchema>;
