import { injectable } from "tsyringe";
import { Request, Response } from "express";

import { genericResponse } from "@/common/utils/http";
import { CapabilityRegistryService } from "./services/capability-registry.service";

@injectable()
export class CapabilityRegistryController {
  constructor(
    private readonly capabilityRegistryService: CapabilityRegistryService,
  ) {}

  public get = async (request: Request, response: Response) => {
    const { project_id } = request.params;

    const snapshot = await this.capabilityRegistryService.getSnapshot(
      project_id,
    );

    return genericResponse({
      response,
      data: { status: true, message: "Capabilities retrieved", data: snapshot },
    });
  };

  public refresh = async (request: Request, response: Response) => {
    const { project_id } = request.params;

    const snapshot = await this.capabilityRegistryService.refresh(project_id);

    return genericResponse({
      response,
      data: { status: true, message: "Capabilities refreshed", data: snapshot },
    });
  };
}
