import "reflect-metadata";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import "express-async-errors";
import http from "http";
import { existsSync } from "fs";
import path from "path";
import { singleton } from "tsyringe";

import { bootstrap } from "./bootstrap";
import routes from "./common/routes";
import {
  globalErrorHandler,
  routeNotFoundHandler,
} from "./common/routes/others";
import {
  AppNextFunction,
  AppRequest,
  AppResponse,
  AppServer,
} from "./common/types/http";
import { app as appConf } from "./conf/env";

const UI_DIR = path.join(__dirname, "../public");
const UI_INDEX_FILE = path.join(UI_DIR, "index.html");

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
      console.log(`Subgrid server listening on port ${port}`);
    });
  }

  public async close() {
    if (this._serverInstance) {
      this._serverInstance.close();
    }
  }

  private registerMiddlewares() {
    this.app.use(cors({ origin: appConf.client_origin, credentials: true }));

    this.app.use(express.json({ limit: "5mb" }));
    this.app.use(express.urlencoded({ extended: true, limit: "5mb" }));
    this.app.use(cookieParser());

    this.app.use(
      async (req: AppRequest, res: AppResponse, next: AppNextFunction) => {
        try {
          await next();
        } catch (err) {
          next(err);
        }
      },
    );

    const uiBundled = existsSync(UI_INDEX_FILE);

    if (uiBundled) this.app.use(express.static(UI_DIR));

    routes(this.app);

    if (uiBundled) {
      this.app.get(/^(?!\/api\/).*/, (_req: AppRequest, res: AppResponse) => {
        res.sendFile(UI_INDEX_FILE);
      });
    }

    this.app.use(routeNotFoundHandler);

    this.app.use(globalErrorHandler);
  }
}
