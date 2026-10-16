import { injectable } from 'tsyringe';
import { Request, Response } from 'express';

import { genericResponse } from '@/common/utils/http';
import { CallToolDto } from './dto/validation.dto';
import { OrchestratorService } from './services/orchestrator.service';

@injectable()
export class OrchestratorController {
	constructor(private readonly orchestratorService: OrchestratorService) {}

	public listTools = async (request: Request, response: Response) => {
		const { server_id } = request.params;

		const data = await this.orchestratorService.listTools(server_id);

		return genericResponse({ response, data });
	};

	public callTool = async (request: Request, response: Response) => {
		const { server_id } = request.params;
		const payload = request.body as CallToolDto;

		const data = await this.orchestratorService.callTool(server_id, payload);

		return genericResponse({ response, data });
	};

	public history = async (request: Request, response: Response) => {
		const { server_id, project_id } = request.query as { server_id?: string; project_id?: string };

		const data = await this.orchestratorService.history(server_id, project_id);

		return genericResponse({ response, data });
	};
}
