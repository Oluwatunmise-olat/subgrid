import pino from "pino";

import { app } from "@/conf/env";

export const logger = pino({
  level: app.env === "production" ? "info" : "debug",
  transport:
    app.env === "production"
      ? undefined
      : {
          target: "pino-pretty",
          options: { colorize: true },
        },
});
