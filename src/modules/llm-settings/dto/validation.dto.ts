import { z } from "zod";

export const setLlmSettingsSchema = z.object({
  provider: z.enum(["openai", "openrouter"]),
  api_key: z.string().min(1),
  approval_token: z.string().optional(),
});

export type SetLlmSettingsDto = z.infer<typeof setLlmSettingsSchema>;
