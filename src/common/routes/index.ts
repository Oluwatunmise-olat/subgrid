import { Request, Response } from "express";

import { mcpRegistryRoutes } from "@/modules/mcp-registry/mcp-registry.routes";
import { mcpOAuthRoutes } from "@/modules/oauth/oauth.routes";
import { orchestratorRoutes } from "@/modules/orchestrator/orchestrator.routes";
import { planningRoutes } from "@/modules/planning/planning.routes";
import { capabilityRegistryRoutes } from "@/modules/capability-registry/capability-registry.routes";
import { projectsRoutes } from "@/modules/projects/projects.routes";
import { workflowRoutes } from "@/modules/workflows/workflow.routes";
import { securityRoutes } from "@/modules/security/security.routes";
import { catalogRoutes } from "@/modules/catalog/catalog.routes";
import { llmSettingsRoutes } from "@/modules/llm-settings/llm-settings.routes";
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
  server.use(`${RoutePrefix.V1}/workflows`, requireSession);
  server.use(`${RoutePrefix.V1}/catalog`, requireSession);
  server.use(`${RoutePrefix.V1}/llm-settings`, requireSession);

  catalogRoutes(server, `${RoutePrefix.V1}/catalog`);
  llmSettingsRoutes(server, `${RoutePrefix.V1}/llm-settings`);

  projectsRoutes(server, `${RoutePrefix.V1}/projects`);
  planningRoutes(server, `${RoutePrefix.V1}/projects`);
  capabilityRegistryRoutes(server, `${RoutePrefix.V1}/projects`);
  mcpRegistryRoutes(server, `${RoutePrefix.V1}/mcp-servers`);
  mcpOAuthRoutes(server, `${RoutePrefix.V1}/mcp-servers`);
  orchestratorRoutes(server, `${RoutePrefix.V1}/mcp-servers`);
  workflowRoutes(server, `${RoutePrefix.V1}/workflows`);
};
