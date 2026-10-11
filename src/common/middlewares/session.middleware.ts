import { NextFunction, Request, Response } from 'express';
import { container } from 'tsyringe';

import { UnAuthorizedError } from '@/common/utils/errors/app.error';
import { SessionService } from '@/modules/security/services/session.service';

const requireSession = (request: Request, _response: Response, next: NextFunction) => {
	const sessionService = container.resolve(SessionService);

	if (!sessionService.isAuthenticated(request)) {
		throw new UnAuthorizedError('Sign in with a passkey first');
	}

	next();
};

export default requireSession;
