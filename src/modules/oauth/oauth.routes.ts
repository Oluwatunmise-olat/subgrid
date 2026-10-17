import { container } from 'tsyringe';

import { AppServer } from '@/common/types/http';
import { McpOAuthController } from './oauth.controller';

const mcpOAuthController = container.resolve(McpOAuthController);

export const mcpOAuthRoutes = (server: AppServer, prefix: string) => {
	server.post(`${prefix}/:server_id/oauth/authorize`, mcpOAuthController.initiate);
	server.get(`${prefix}/:server_id/oauth/callback`, mcpOAuthController.callback);
	server.get(`${prefix}/:server_id/oauth/status`, mcpOAuthController.status);
	server.delete(`${prefix}/:server_id/oauth`, mcpOAuthController.disconnect);
};
