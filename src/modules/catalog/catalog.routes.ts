import { container } from "tsyringe";

import { AppServer } from "@/common/types/http";
import { CatalogController } from "./catalog.controller";

const catalogController = container.resolve(CatalogController);

export const catalogRoutes = (server: AppServer, prefix: string) => {
  server.get(`${prefix}`, catalogController.list);
};
