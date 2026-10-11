import { StatusCodes } from 'http-status-codes';

import AppError from './base.error';

export class BadRequestError extends AppError {
	constructor(message: string, resData: any = {}, methodName?: string) {
		super(message, StatusCodes.BAD_REQUEST, resData, methodName);
	}
}

export class NotFoundError extends AppError {
	constructor(message: string, resData: any = {}, methodName?: string) {
		super(message, StatusCodes.NOT_FOUND, resData, methodName);
	}
}

export class ConflictError extends AppError {
	constructor(message: string, resData: any = {}, methodName?: string) {
		super(message, StatusCodes.CONFLICT, resData, methodName);
	}
}

export class ValidatorError extends AppError {
	constructor(message: string, resData: any = {}, methodName?: string) {
		super(message, StatusCodes.UNPROCESSABLE_ENTITY, resData, methodName);
	}
}

export class McpConnectionError extends AppError {
	constructor(message: string, resData: any = {}, methodName?: string) {
		super(message, StatusCodes.BAD_GATEWAY, resData, methodName);
	}
}

export class ForbiddenError extends AppError {
	constructor(message: string, resData: any = {}, methodName?: string) {
		super(message, StatusCodes.FORBIDDEN, resData, methodName);
	}
}

export class UnAuthorizedError extends AppError {
	constructor(message: string, resData: any = {}, methodName?: string) {
		super(message, StatusCodes.UNAUTHORIZED, resData, methodName);
	}
}
