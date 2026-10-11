import 'reflect-metadata';
import cors from 'cors';
import express from 'express';
import 'express-async-errors';
import http from 'http';
import { singleton } from 'tsyringe';

import { bootstrap } from './bootstrap';
import routes from './common/routes';
import { globalErrorHandler, routeNotFoundHandler } from './common/routes/others';
import { AppNextFunction, AppRequest, AppResponse, AppServer } from './common/types/http';
import { app as appConf } from './conf/env';

@singleton()
export default class Application {
	private _serverInstance!: http.Server;
	private readonly app: AppServer;
	private bootstrapPromise: Promise<void>;

	constructor() {
		this.app = express();
		this.registerMiddlewares();
		this.bootstrapPromise = bootstrap();
	}

	public async listen(port: number) {
		await this.bootstrapPromise;

		this._serverInstance = this.app.listen(port, () => {
			console.log(`🚀 Subgrid server listening on port ${port}`);
		});
	}

	public async close() {
		if (this._serverInstance) {
			this._serverInstance.close();
		}
	}

	private registerMiddlewares() {
		this.app.use(cors({ origin: appConf.client_origin, credentials: true }));

		this.app.use(express.json({ limit: '5mb' }));
		this.app.use(express.urlencoded({ extended: true, limit: '5mb' }));

		this.app.use(async (req: AppRequest, res: AppResponse, next: AppNextFunction) => {
			try {
				await next();
			} catch (err) {
				next(err);
			}
		});

		routes(this.app);

		this.app.use(routeNotFoundHandler);

		this.app.use(globalErrorHandler);
	}
}
