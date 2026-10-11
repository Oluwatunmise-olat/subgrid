import { container } from 'tsyringe';

import { validate } from '@/common/middlewares/validator.middleware';
import { AppServer } from '@/common/types/http';
import { createProjectSchema, updateProjectSchema } from './dto/validation.dto';
import { ProjectsController } from './projects.controller';

const projectsController = container.resolve(ProjectsController);

export const projectsRoutes = (server: AppServer, prefix: string) => {
	server.post(`${prefix}`, validate(createProjectSchema), projectsController.create);
	server.get(`${prefix}`, projectsController.list);
	server.put(`${prefix}/:project_id`, validate(updateProjectSchema), projectsController.update);
	server.delete(`${prefix}/:project_id`, projectsController.remove);
};
