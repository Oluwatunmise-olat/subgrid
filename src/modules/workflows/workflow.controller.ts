import { injectable } from "tsyringe";
import { Request, Response } from "express";

import { genericResponse } from "@/common/utils/http";
import { WorkflowRuntimeService } from "./services/workflow-runtime.service";
import { UpdateWorkflowDto } from "./dto/validation.dto";

@injectable()
export class WorkflowController {
  constructor(
    private readonly workflowRuntimeService: WorkflowRuntimeService,
  ) {}

  public get = async (request: Request, response: Response) => {
    const { workflow_id } = request.params;
    const workflow = await this.workflowRuntimeService.getWorkflow(workflow_id);

    return genericResponse({
      response,
      data: { status: true, message: "Workflow retrieved", data: { workflow } },
    });
  };

  public update = async (request: Request, response: Response) => {
    const { workflow_id } = request.params;
    const payload = request.body as UpdateWorkflowDto;
    const workflow = await this.workflowRuntimeService.updateWorkflow(
      workflow_id,
      payload,
    );

    return genericResponse({
      response,
      data: { status: true, message: "Workflow updated", data: { workflow } },
    });
  };

  public approve = async (request: Request, response: Response) => {
    const { workflow_id } = request.params;
    const workflow = await this.workflowRuntimeService.approveWorkflow(
      workflow_id,
    );

    return genericResponse({
      response,
      data: { status: true, message: "Workflow approved", data: { workflow } },
    });
  };

  public cancel = async (request: Request, response: Response) => {
    const { workflow_id } = request.params;
    const workflow = await this.workflowRuntimeService.cancelWorkflow(
      workflow_id,
    );

    return genericResponse({
      response,
      data: { status: true, message: "Workflow cancelled", data: { workflow } },
    });
  };

  public execute = async (request: Request, response: Response) => {
    const { workflow_id } = request.params;
    const workflow = await this.workflowRuntimeService.executeWorkflow(
      workflow_id,
    );

    return genericResponse({
      response,
      data: { status: true, message: "Workflow executed", data: { workflow } },
    });
  };

  public retryStep = async (request: Request, response: Response) => {
    const { workflow_id, step_id } = request.params;
    const workflow = await this.workflowRuntimeService.retryStep(
      workflow_id,
      step_id,
      Boolean(request.body?.allowAlways),
    );

    return genericResponse({
      response,
      data: { status: true, message: "Step retried", data: { workflow } },
    });
  };
}
