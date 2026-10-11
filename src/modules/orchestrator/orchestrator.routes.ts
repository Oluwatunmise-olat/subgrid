import { container } from 'tsyringe';

import { validate } from '@/common/middlewares/validator.middleware';
import { AppServer } from '@/common/types/http';
import { callToolSchema } from './dto/validation.dto';
import { OrchestratorController } from './orchestrator.controller';

const orchestratorController = container.resolve(OrchestratorController);

export const orchestratorRoutes = (server: AppServer, prefix: string) => {
	server.get(`${prefix}/history`, orchestratorController.history);
	server.get(`${prefix}/:server_id/tools`, orchestratorController.listTools);
	server.post(`${prefix}/:server_id/tools/call`, validate(callToolSchema), orchestratorController.callTool);
};
