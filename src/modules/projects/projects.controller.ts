import { injectable } from 'tsyringe';
import { Request, Response } from 'express';

import { genericResponse } from '@/common/utils/http';
import { CreateProjectDto, SuggestComponentsDto, UpdateProjectDto } from './dto/validation.dto';
import { ProjectsService } from './services/projects.service';
import { SuggestionService } from '@/modules/catalog/services/suggestion.service';

@injectable()
export class ProjectsController {
	constructor(
		private readonly projectsService: ProjectsService,
		private readonly suggestionService: SuggestionService,
	) {}

	public suggest = async (request: Request, response: Response) => {
		const { project_id } = request.params;
		const payload = request.body as SuggestComponentsDto;

		const data = await this.suggestionService.suggest(project_id, payload.description);

		return genericResponse({ response, data });
	};

	public create = async (request: Request, response: Response) => {
		const payload = request.body as CreateProjectDto;

		const data = await this.projectsService.create(payload);

		return genericResponse({ response, data });
	};

	public list = async (_request: Request, response: Response) => {
		const data = await this.projectsService.list();

		return genericResponse({ response, data });
	};

	public update = async (request: Request, response: Response) => {
		const { project_id } = request.params;
		const payload = request.body as UpdateProjectDto;

		const data = await this.projectsService.update(project_id, payload);

		return genericResponse({ response, data });
	};

	public remove = async (request: Request, response: Response) => {
		const { project_id } = request.params;

		const data = await this.projectsService.remove(project_id);

		return genericResponse({ response, data });
	};
}
