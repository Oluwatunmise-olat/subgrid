import { StatusCodes } from 'http-status-codes';
import { Response } from 'express';

import { ObjectLiteral } from '../types/any';

export const successResponse = (response: Response, message: string, data?: ObjectLiteral, statusCode: number = StatusCodes.OK): void => {
	if (!Number.isInteger(statusCode)) statusCode = StatusCodes.OK;

	response.status(statusCode).send({ success: true, message, data });
};

export const errorResponse = (response: Response, message: string, data?: ObjectLiteral, statusCode: number = StatusCodes.BAD_REQUEST): void => {
	if (!Number.isInteger(statusCode)) statusCode = StatusCodes.BAD_REQUEST;

	response.status(statusCode).send({ success: false, message, data });
};

export const genericResponse = (params: {
	response: Response;
	data: {
		status: boolean;
		message: string;
		data?: ObjectLiteral;
	};
	statusCode?: StatusCodes;
}) => {
	const { response, data: responseData, statusCode } = params;

	if (responseData.status !== true) return errorResponse(response, responseData.message, responseData.data, statusCode);

	return successResponse(response, responseData.message, responseData.data, statusCode);
};
