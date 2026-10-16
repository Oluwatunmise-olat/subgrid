import { container } from 'tsyringe';

import { validate } from '@/common/middlewares/validator.middleware';
import { AppServer } from '@/common/types/http';
import { retryStepSchema, updateWorkflowSchema } from './dto/validation.dto';
import { WorkflowController } from './workflow.controller';

const workflowController = container.resolve(WorkflowController);

export const workflowRoutes = (server: AppServer, prefix: string) => {
	server.get(`${prefix}/:workflow_id`, workflowController.get);
	server.patch(`${prefix}/:workflow_id`, validate(updateWorkflowSchema), workflowController.update);
	server.post(`${prefix}/:workflow_id/approve`, workflowController.approve);
	server.post(`${prefix}/:workflow_id/cancel`, workflowController.cancel);
	server.post(`${prefix}/:workflow_id/execute`, workflowController.execute);
	server.post(`${prefix}/:workflow_id/steps/:step_id/retry`, validate(retryStepSchema), workflowController.retryStep);
};
