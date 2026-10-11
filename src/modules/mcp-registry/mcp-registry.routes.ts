import { container } from 'tsyringe';

import { validate } from '@/common/middlewares/validator.middleware';
import { AppServer } from '@/common/types/http';
import { registerServerSchema, updateServerSchema } from './dto/validation.dto';
import { McpRegistryController } from './mcp-registry.controller';

const mcpRegistryController = container.resolve(McpRegistryController);

export const mcpRegistryRoutes = (server: AppServer, prefix: string) => {
	server.post(`${prefix}`, validate(registerServerSchema), mcpRegistryController.register);
	server.get(`${prefix}`, mcpRegistryController.list);
	server.put(`${prefix}/:server_id`, validate(updateServerSchema), mcpRegistryController.update);
	server.delete(`${prefix}/:server_id`, mcpRegistryController.remove);
	server.post(`${prefix}/:server_id/health-check`, mcpRegistryController.checkHealth);
};
