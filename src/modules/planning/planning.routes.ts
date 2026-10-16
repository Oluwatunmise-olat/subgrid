import { container } from 'tsyringe';

import { validate } from '@/common/middlewares/validator.middleware';
import { AppServer } from '@/common/types/http';
import { createPlanSchema } from './dto/validation.dto';
import { PlanningController } from './planning.controller';

const planningController = container.resolve(PlanningController);

export const planningRoutes = (server: AppServer, prefix: string) => {
	server.post(`${prefix}/:project_id/plan`, validate(createPlanSchema), planningController.create);
};
