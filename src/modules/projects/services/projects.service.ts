import { injectable } from 'tsyringe';

import { ProjectsRepository, McpServersRepository } from '@/repositories';
import { BadRequestError, NotFoundError } from '@/common/utils/errors/app.error';
import { ProjectType } from '@/models/project.model';
import { CreateProjectDto, UpdateProjectDto } from '../dto/validation.dto';

@injectable()
export class ProjectsService {
	constructor(
		private readonly projectsRepository: ProjectsRepository,
		private readonly mcpServersRepository: McpServersRepository,
	) {}

	public async create(payload: CreateProjectDto) {
		const existing = await this.projectsRepository.getBySlug(payload.slug);

		if (existing) throw new BadRequestError(`A project with slug "${payload.slug}" already exists`);

		const existingDeleted = await this.projectsRepository.getBySlugIncludingDeleted(payload.slug);

		if (existingDeleted && (existingDeleted as unknown as ProjectType).deleted_at) {
			await this.projectsRepository.update(
				{ id: (existingDeleted as unknown as ProjectType).id } as Partial<ProjectType>,
				{ ...payload, deleted_at: null } as Partial<ProjectType>,
			);

			const restored = await this.projectsRepository.getById((existingDeleted as unknown as ProjectType).id);

			return { status: true, message: 'Project restored', data: { project: restored } };
		}

		try {
			const created = await this.projectsRepository.create(payload);

			return { status: true, message: 'Project created', data: { project: created } };
		} catch (err) {
			if ((err as { code?: string })?.code === '23505') {
				throw new BadRequestError(`A project with slug "${payload.slug}" already exists`);
			}

			throw err;
		}
	}

	public async list() {
		const projects = await this.projectsRepository.findMany({});

		return { status: true, message: 'Projects retrieved', data: { projects } };
	}

	public async update(id: string, payload: UpdateProjectDto) {
		const existing = await this.projectsRepository.getById(id);

		if (!existing) throw new NotFoundError('Project not found');

		await this.projectsRepository.update({ id } as Partial<ProjectType>, payload as Partial<ProjectType>);

		return { status: true, message: 'Project updated' };
	}

	public async remove(id: string) {
		const existing = await this.projectsRepository.getById(id);

		if (!existing) throw new NotFoundError('Project not found');

		const servers = await this.mcpServersRepository.findMany({ project_id: id } as Partial<ProjectType> as any);

		if (servers.length > 0) {
			throw new BadRequestError('Project still has MCP servers registered. Remove them first.');
		}

		await this.projectsRepository.delete({ id } as Partial<ProjectType>);

		return { status: true, message: 'Project removed' };
	}
}
