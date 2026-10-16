import { injectable } from "tsyringe";
import { Request, Response } from "express";

import { genericResponse } from "@/common/utils/http";
import { CatalogService } from "./catalog.service";

@injectable()
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  public list = async (_request: Request, response: Response) => {
    const data = this.catalogService.list();

    return genericResponse({ response, data });
  };
}
