import { container } from 'tsyringe';

import { AppServer } from '@/common/types/http';
import { CapabilityRegistryController } from './capability-registry.controller';

const capabilityRegistryController = container.resolve(CapabilityRegistryController);

export const capabilityRegistryRoutes = (server: AppServer, prefix: string) => {
	server.get(`${prefix}/:project_id/capabilities`, capabilityRegistryController.get);
	server.post(`${prefix}/:project_id/capabilities/refresh`, capabilityRegistryController.refresh);
};
