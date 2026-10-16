import { z } from 'zod';

export const toolFilterSchema = z.object({
	include: z.array(z.string()).optional(),
	exclude: z.array(z.string()).optional(),
});

export const approvalPolicySchema = z.enum(['auto', 'prompt', 'always']);

export const registerServerSchema = z.object({
	project_id: z.string().min(1),
	name: z.string().min(1),
	slug: z
		.string()
		.min(1)
		.regex(/^[a-z0-9-]+$/, 'slug must be lowercase alphanumeric with dashes'),
	category: z.enum(['storage', 'paas', 'dns', 'email', 'database', 'other']).default('other'),
	provider: z.string().optional(),
	transport: z.enum(['stdio', 'sse', 'http']).optional(),
	command: z.string().optional(),
	args: z.array(z.string()).optional(),
	url: z.string().url().optional(),
	env: z.record(z.string()).optional(),
	headers: z.record(z.string()).optional(),
	approval_token: z.string().optional(),
	reuse_keys: z.record(z.string()).optional(),
	tool_filter: toolFilterSchema.nullable().optional(),
	approval_policy: approvalPolicySchema.optional(),
	approved_tools: z.array(z.string()).nullable().optional(),
	integration_id: z.string().optional(),
	preset_id: z.string().optional(),
});

export const updateServerSchema = registerServerSchema.partial().omit({ project_id: true });

export type RegisterServerDto = z.infer<typeof registerServerSchema>;
export type UpdateServerDto = z.infer<typeof updateServerSchema>;
