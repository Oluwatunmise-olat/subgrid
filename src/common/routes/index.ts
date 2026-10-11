import { Request, Response } from "express";

import { mcpRegistryRoutes } from "@/modules/mcp-registry/mcp-registry.routes";
import { mcpOAuthRoutes } from "@/modules/mcp-registry/oauth.routes";
import { orchestratorRoutes } from "@/modules/orchestrator/orchestrator.routes";
import { projectsRoutes } from "@/modules/projects/projects.routes";
import { securityRoutes } from "@/modules/security/security.routes";
import requireSession from "../middlewares/session.middleware";
import { RoutePrefix } from "../enums/generic";
import { AppServer } from "../types/http";
import { successResponse } from "../utils/http";

export default (server: AppServer): void => {
  server.get(`/`, (_: Request, response: Response) => {
    return successResponse(response, "Welcome to Subgrid");
  });

  server.get(`/health`, (_: Request, response: Response) => {
    return successResponse(response, "OK");
  });

  securityRoutes(server, `${RoutePrefix.V1}/security`);

  server.use(`${RoutePrefix.V1}/projects`, requireSession);
  server.use(`${RoutePrefix.V1}/mcp-servers`, requireSession);

  projectsRoutes(server, `${RoutePrefix.V1}/projects`);
  mcpRegistryRoutes(server, `${RoutePrefix.V1}/mcp-servers`);
  mcpOAuthRoutes(server, `${RoutePrefix.V1}/mcp-servers`);
  orchestratorRoutes(server, `${RoutePrefix.V1}/mcp-servers`);
};
