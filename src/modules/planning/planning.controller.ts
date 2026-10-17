import { injectable } from "tsyringe";
import { Request, Response } from "express";

import { genericResponse } from "@/common/utils/http";
import { PlanningService } from "./services/planning.service";
import { CreatePlanDto } from "./dto/validation.dto";

@injectable()
export class PlanningController {
  constructor(private readonly planningService: PlanningService) {}

  public create = async (request: Request, response: Response) => {
    const { project_id } = request.params;

    const { message, history } = request.body as CreatePlanDto;

    const data = await this.planningService.plan(
      project_id,
      message,
      history as { role: "user" | "assistant"; content: string }[] | undefined,
    );

    return genericResponse({ response, data });
  };
}
