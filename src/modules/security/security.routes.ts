import { container } from 'tsyringe';

import { validate } from '@/common/middlewares/validator.middleware';
import { AppServer } from '@/common/types/http';
import { approvalOptionsSchema, approvalVerifySchema, registrationVerifySchema } from './dto/validation.dto';
import { SecurityController } from './security.controller';

const securityController = container.resolve(SecurityController);

export const securityRoutes = (server: AppServer, prefix: string) => {
	server.get(`${prefix}/passkeys`, securityController.list);
	server.delete(`${prefix}/passkeys/:passkey_id`, securityController.remove);

	server.post(`${prefix}/passkeys/registration/options`, securityController.registrationOptions);
	server.post(`${prefix}/passkeys/registration/verify`, validate(registrationVerifySchema), securityController.registrationVerify);

	server.post(`${prefix}/passkeys/approval/options`, validate(approvalOptionsSchema), securityController.approvalOptions);
	server.post(`${prefix}/passkeys/approval/verify`, validate(approvalVerifySchema), securityController.approvalVerify);
};
