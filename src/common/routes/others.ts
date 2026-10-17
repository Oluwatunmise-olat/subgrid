import { StatusCodes } from "http-status-codes";
import { NextFunction, Request, Response } from "express";

import { logger } from "../utils/logger/pino";
import AppError from "../utils/errors/base.error";
import { errorResponse } from "../utils/http";
import { app } from "@/conf/env";

const LOG_PREFIX = "[DEFAULT ROUTER HANDLERS]";

export const routeNotFoundHandler = (
  req: Request,
  response: Response,
): void => {
  const message = "The requested resource was not found";

  errorResponse(response, message, {}, StatusCodes.NOT_FOUND);
};

export const globalErrorHandler = (
  error: Error | AppError,
  _: Request,
  response: Response,
  next: NextFunction,
) => {
  if (response.headersSent) return next(error);

  const statusCode =
    error instanceof AppError
      ? error.statusCode
      : StatusCodes.INTERNAL_SERVER_ERROR;

  let message: string;

  if (error instanceof AppError) {
    message = error.message;
  } else if (app.env !== "production") {
    message = `Server error: ${error.message}`;
  } else {
    message =
      "An unexpected error occurred. Please try again later or contact support";
  }

  logger.error(
    { err: error, url: response.req.url },
    `${LOG_PREFIX} Global error handler`,
  );

  const errorData = error instanceof AppError ? error.resData : {};

  return errorResponse(response, message, errorData, statusCode);
};
