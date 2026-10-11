import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';

import { ValidatorError } from '@/common/utils/errors/app.error';

export const validate = (schema: ZodSchema) => (request: Request, _response: Response, next: NextFunction) => {
	const result = schema.safeParse(request.body);

	if (!result.success) {
		const message = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join(', ');
		throw new ValidatorError(message);
	}

	request.body = result.data;

	next();
};
