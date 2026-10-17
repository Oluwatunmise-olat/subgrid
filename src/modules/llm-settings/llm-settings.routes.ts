import { container } from "tsyringe";

import { validate } from "@/common/middlewares/validator.middleware";
import { AppServer } from "@/common/types/http";
import { setLlmSettingsSchema } from "./dto/validation.dto";
import { LlmSettingsController } from "./llm-settings.controller";

const llmSettingsController = container.resolve(LlmSettingsController);

export const llmSettingsRoutes = (server: AppServer, prefix: string) => {
  server.get(`${prefix}`, llmSettingsController.status);
  server.put(`${prefix}`, validate(setLlmSettingsSchema), llmSettingsController.set);
  server.delete(`${prefix}`, llmSettingsController.clear);
};
