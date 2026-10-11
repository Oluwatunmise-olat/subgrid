import { z } from 'zod';

export const registrationVerifySchema = z.object({
	session_id: z.string().min(1),
	label: z.string().optional(),
	response: z.record(z.any()),
});

export const approvalOptionsSchema = z.object({
	action: z.string().min(1),
});

export const approvalVerifySchema = z.object({
	session_id: z.string().min(1),
	response: z.record(z.any()),
});

export type RegistrationVerifyDto = z.infer<typeof registrationVerifySchema>;
export type ApprovalOptionsDto = z.infer<typeof approvalOptionsSchema>;
export type ApprovalVerifyDto = z.infer<typeof approvalVerifySchema>;
