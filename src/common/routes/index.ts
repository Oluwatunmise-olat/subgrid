import { Request, Response } from 'express';

import { mcpRegistryRoutes } from '@/modules/mcp-registry/mcp-registry.routes';
import { orchestratorRoutes } from '@/modules/orchestrator/orchestrator.routes';
import { projectsRoutes } from '@/modules/projects/projects.routes';
import { securityRoutes } from '@/modules/security/security.routes';
import { RoutePrefix } from '../enums/generic';
import { AppServer } from '../types/http';
import { successResponse } from '../utils/http';

export default (server: AppServer): void => {
	server.get(`/`, (_: Request, response: Response) => {
		return successResponse(response, 'Welcome to Subgrid 🐣');
	});

	server.get(`/health`, (_: Request, response: Response) => {
		return successResponse(response, 'OK');
	});

	projectsRoutes(server, `${RoutePrefix.V1}/projects`);
	securityRoutes(server, `${RoutePrefix.V1}/security`);
	mcpRegistryRoutes(server, `${RoutePrefix.V1}/mcp-servers`);
	orchestratorRoutes(server, `${RoutePrefix.V1}/mcp-servers`);
};
