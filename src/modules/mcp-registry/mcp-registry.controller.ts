import { injectable } from 'tsyringe';
import { Request, Response } from 'express';

import { genericResponse } from '@/common/utils/http';
import { RegisterServerDto, UpdateServerDto } from './dto/validation.dto';
import { McpRegistryService } from './services/mcp-registry.service';

@injectable()
export class McpRegistryController {
	constructor(private readonly mcpRegistryService: McpRegistryService) {}

	public register = async (request: Request, response: Response) => {
		const payload = request.body as RegisterServerDto;

		const data = await this.mcpRegistryService.register(payload);

		return genericResponse({ response, data });
	};

	public list = async (request: Request, response: Response) => {
		const { project_id } = request.query as { project_id?: string };

		const data = await this.mcpRegistryService.list(project_id);

		return genericResponse({ response, data });
	};

	public update = async (request: Request, response: Response) => {
		const { server_id } = request.params;
		const payload = request.body as UpdateServerDto;

		const data = await this.mcpRegistryService.update(server_id, payload);

		return genericResponse({ response, data });
	};

	public remove = async (request: Request, response: Response) => {
		const { server_id } = request.params;

		const data = await this.mcpRegistryService.remove(server_id);

		return genericResponse({ response, data });
	};

	public checkHealth = async (request: Request, response: Response) => {
		const { server_id } = request.params;

		const data = await this.mcpRegistryService.checkHealth(server_id);

		return genericResponse({ response, data });
	};
}
