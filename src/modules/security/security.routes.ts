import { container } from 'tsyringe';

import requireSession from '@/common/middlewares/session.middleware';
import { validate } from '@/common/middlewares/validator.middleware';
import { AppServer } from '@/common/types/http';
import { approvalOptionsSchema, approvalVerifySchema, registrationVerifySchema } from './dto/validation.dto';
import { SecurityController } from './security.controller';

const securityController = container.resolve(SecurityController);

export const securityRoutes = (server: AppServer, prefix: string) => {
	server.get(`${prefix}/session`, securityController.sessionStatus);
	server.post(`${prefix}/session/logout`, securityController.logout);

	server.get(`${prefix}/passkeys/exists`, securityController.exists);
	server.get(`${prefix}/passkeys`, requireSession, securityController.list);
	server.delete(`${prefix}/passkeys/:passkey_id`, requireSession, securityController.remove);

	server.post(`${prefix}/passkeys/registration/options`, securityController.registrationOptions);
	server.post(`${prefix}/passkeys/registration/verify`, validate(registrationVerifySchema), securityController.registrationVerify);

	server.post(`${prefix}/passkeys/approval/options`, validate(approvalOptionsSchema), securityController.approvalOptions);
	server.post(`${prefix}/passkeys/approval/verify`, validate(approvalVerifySchema), securityController.approvalVerify);
};
