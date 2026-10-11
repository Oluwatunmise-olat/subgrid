import { NextFunction, Request, Response } from 'express';
import express from 'express';

export type AppServer = ReturnType<typeof express>;
export type AppRequest = Request;
export type AppResponse = Response;
export type AppNextFunction = NextFunction;

export interface AuthenticatedRequest extends Request {
	user?: { id: string };
}
