import { injectable } from "tsyringe";

import {
  WorkflowsRepository,
  WorkflowStepsRepository,
  McpServersRepository,
} from "@/repositories";
import { NotFoundError, BadRequestError } from "@/common/utils/errors/app.error";
import { WorkflowType } from "@/models/workflow.model";
import type { WorkflowStatus } from "@/models/types";
import { WorkflowStepType } from "@/models/workflow-step.model";
import { McpServerType } from "@/models/mcp-server.model";
import { ToolCapability } from "@/modules/planning/types/planning.types";
import { OrchestratorService } from "@/modules/orchestrator/services/orchestrator.service";
import { normalizeToolResult } from "@/modules/orchestrator/services/result-normalizer";
import { UpdateWorkflowDto } from "../dto/validation.dto";
import { PlannedStep } from "../types/workflow.types";
import {
  EDITABLE_STATUSES,
  EXECUTABLE_STATUSES,
  TERMINAL_STATUSES,
} from "@/common/constants/workflow-runtime.constants";
import {
  referencedStepIndexes,
  resolveStepInput,
} from "./step-input";

@injectable()
export class WorkflowRuntimeService {
  constructor(
    private readonly workflowsRepository: WorkflowsRepository,
    private readonly workflowStepsRepository: WorkflowStepsRepository,
    private readonly mcpServersRepository: McpServersRepository,
    private readonly orchestratorService: OrchestratorService,
  ) {}

  public async createFromPlan(params: {
    projectId: string;
    request: string;
    note: string | null;
    executionMode: "sequential" | "parallel";
    steps: PlannedStep[];
  }) {
    const workflow = await this.workflowsRepository.create({
      project_id: params.projectId,
      request: params.request,
      mode: "plan",
      execution_mode: params.executionMode,
      status: "awaiting_approval",
      note: params.note,
      version: 1,
    });

    const createdIds: string[] = [];

    for (const [index, step] of params.steps.entries()) {
      const dependsOn = referencedStepIndexes(step.input)
        .map((reference) => createdIds[reference - 1])
        .filter((id): id is string => Boolean(id));

      const created = (await this.workflowStepsRepository.create({
        workflow_id: workflow.id,
        order: index,
        depends_on: dependsOn,
        server_id: step.serverId,
        capability: step.capability,
        tool_name: step.toolName,
        title: step.title || step.toolName,
        intent: step.intent || null,
        input: step.input,
        status: "pending",
        requires_approval: !step.capability.readOnly,
      })) as { id: string };

      createdIds.push(created.id);
    }

    return this.getWorkflow(workflow.id);
  }

  public async getWorkflow(id: string) {
    const workflow = await this.getWorkflowOrThrow(id);
    const steps = await this.workflowStepsRepository.findByWorkflow(id);
    return { ...workflow, steps };
  }

  public async updateWorkflow(id: string, patch: UpdateWorkflowDto) {
    const workflow = await this.getWorkflowOrThrow(id);
    if (!EDITABLE_STATUSES.includes(workflow.status))
      throw new BadRequestError(
        `Cannot edit a workflow in status "${workflow.status}"`,
      );

    if (patch.executionMode) {
      await this.workflowsRepository.update(
        { id } as Partial<WorkflowType>,
        { execution_mode: patch.executionMode } as Partial<WorkflowType>,
      );
    }

    if (patch.removeStepIds?.length) {
      for (const stepId of patch.removeStepIds) {
        await this.workflowStepsRepository.delete(
          { id: stepId } as Partial<WorkflowStepType>,
          true,
        );
      }
    }

    if (patch.updateSteps?.length) {
      for (const step of patch.updateSteps) {
        await this.workflowStepsRepository.update(
          { id: step.id } as Partial<WorkflowStepType>,
          { input: step.input } as Partial<WorkflowStepType>,
        );
      }
    }

    if (patch.addStep) {
      const existing = await this.workflowStepsRepository.findByWorkflow(id);
      await this.workflowStepsRepository.create({
        workflow_id: id,
        order: existing.length,
        depends_on: [],
        server_id: patch.addStep.serverId,
        capability: patch.addStep.capability,
        tool_name: patch.addStep.toolName,
        title: patch.addStep.title || patch.addStep.toolName,
        intent: patch.addStep.intent || null,
        input: patch.addStep.input || {},
        status: "pending",
        requires_approval: !patch.addStep.capability.readOnly,
      });
    }

    if (patch.reorder?.length) {
      await Promise.all(
        patch.reorder.map((stepId, index) =>
          this.workflowStepsRepository.update(
            { id: stepId } as Partial<WorkflowStepType>,
            { order: index } as Partial<WorkflowStepType>,
          ),
        ),
      );
    }

    await this.workflowsRepository.update(
      { id } as Partial<WorkflowType>,
      { version: workflow.version + 1 } as Partial<WorkflowType>,
    );

    return this.getWorkflow(id);
  }

  public async approveWorkflow(id: string) {
    const workflow = await this.getWorkflowOrThrow(id);
    if (!EDITABLE_STATUSES.includes(workflow.status))
      throw new BadRequestError(`Workflow is already "${workflow.status}"`);

    await this.workflowsRepository.update(
      { id } as Partial<WorkflowType>,
      { status: "approved" } as Partial<WorkflowType>,
    );
    return this.getWorkflow(id);
  }

  public async cancelWorkflow(id: string) {
    const workflow = await this.getWorkflowOrThrow(id);
    if (TERMINAL_STATUSES.includes(workflow.status))
      throw new BadRequestError(`Workflow is already "${workflow.status}"`);

    const steps = await this.workflowStepsRepository.findByWorkflow(id);
    await Promise.all(
      steps
        .filter((step) => ["pending", "running"].includes(step.status))
        .map((step) =>
          this.workflowStepsRepository.update(
            { id: step.id } as Partial<WorkflowStepType>,
            { status: "cancelled" } as Partial<WorkflowStepType>,
          ),
        ),
    );

    await this.workflowsRepository.update(
      { id } as Partial<WorkflowType>,
      { status: "cancelled" } as Partial<WorkflowType>,
    );
    return this.getWorkflow(id);
  }

  public async executeWorkflow(id: string) {
    const workflow = await this.getWorkflowOrThrow(id);
    if (!EXECUTABLE_STATUSES.includes(workflow.status))
      throw new BadRequestError(
        `Workflow must be approved before execution (current status: "${workflow.status}")`,
      );

    const steps = await this.workflowStepsRepository.findByWorkflow(id);
    const serverIds = [...new Set(steps.map((step) => step.server_id))];
    const servers = await Promise.all(
      serverIds.map((serverId) => this.mcpServersRepository.getById(serverId)),
    );
    if (servers.some((server) => !server))
      throw new BadRequestError(
        "A connected component in this workflow no longer exists",
      );

    await this.workflowsRepository.update(
      { id } as Partial<WorkflowType>,
      { status: "running" } as Partial<WorkflowType>,
    );
    await this.runSteps(id, workflow.execution_mode);
    return this.getWorkflow(id);
  }

  public async retryStep(
    workflowId: string,
    stepId: string,
    allowAlways = false,
  ) {
    const step = (await this.workflowStepsRepository.getById(
      stepId,
    )) as unknown as WorkflowStepType | undefined;
    if (!step || step.workflow_id !== workflowId)
      throw new NotFoundError("Step not found");

    if (allowAlways) await this.grantStandingApproval(step);

    await this.runOneStep(step, true);
    const workflow = await this.getWorkflowOrThrow(workflowId);
    await this.runSteps(workflowId, workflow.execution_mode);
    return this.getWorkflow(workflowId);
  }

  private async getWorkflowOrThrow(id: string): Promise<WorkflowType> {
    const workflow = await this.workflowsRepository.getById(id);
    if (!workflow) throw new NotFoundError("Workflow not found");
    return workflow as unknown as WorkflowType;
  }

  private async resolveStepReferences(step: WorkflowStepType) {
    const steps = await this.workflowStepsRepository.findByWorkflow(
      step.workflow_id,
    );

    return resolveStepInput(step.input, (index) => {
      const prior = steps[index - 1];

      if (!prior || prior.status !== "succeeded") {
        throw new Error(
          `step ${index} has not succeeded, so its result cannot be used`,
        );
      }

      return prior.output;
    });
  }

  private async grantStandingApproval(step: WorkflowStepType) {
    const server = (await this.mcpServersRepository.getById(
      step.server_id,
    )) as unknown as McpServerType | undefined;

    if (!server) return;

    const granted = new Set(server.approved_tools || []);
    if (granted.has(step.tool_name)) return;
    granted.add(step.tool_name);

    await this.mcpServersRepository.update(
      { id: server.id } as Partial<McpServerType>,
      { approved_tools: [...granted] } as Partial<McpServerType>,
    );
  }

  private async runOneStep(step: WorkflowStepType, approved: boolean) {
    const server = (await this.mcpServersRepository.getById(
      step.server_id,
    )) as unknown as McpServerType | undefined;

    if (!server) {
      await this.workflowStepsRepository.update(
        { id: step.id } as Partial<WorkflowStepType>,
        {
          status: "failed",
          error: "Component no longer exists",
        } as Partial<WorkflowStepType>,
      );
      return "failed" as const;
    }

    let input = step.input;

    if (referencedStepIndexes(step.input).length) {
      try {
        input = (await this.resolveStepReferences(step)) as Record<string, any>;
      } catch (err) {
        await this.workflowStepsRepository.update(
          { id: step.id } as Partial<WorkflowStepType>,
          {
            status: "failed",
            error: err instanceof Error ? err.message : String(err),
          } as Partial<WorkflowStepType>,
        );
        return "failed" as const;
      }
    }

    await this.workflowStepsRepository.update(
      { id: step.id } as Partial<WorkflowStepType>,
      { status: "running" } as Partial<WorkflowStepType>,
    );

    try {
      const outcome = await this.orchestratorService.executeToolCall(
        server,
        step.tool_name,
        input,
        approved,
      );

      if (outcome.kind === "approval_required") {
        await this.workflowStepsRepository.update(
          { id: step.id } as Partial<WorkflowStepType>,
          {
            status: "pending",
            requires_approval: true,
            action_log_id: outcome.action_log.id,
          } as Partial<WorkflowStepType>,
        );
        return "awaiting_approval" as const;
      }

      const structuredResult = normalizeToolResult(
        step.capability as unknown as ToolCapability,
        outcome.result,
      );

      const stepFailed = structuredResult.kind === "error";

      await this.workflowStepsRepository.update(
        { id: step.id } as Partial<WorkflowStepType>,
        {
          status: stepFailed ? "failed" : "succeeded",
          output: structuredResult as unknown as Record<string, any>,
          action_log_id: outcome.action_log.id,
          error: stepFailed ? structuredResult.raw : null,
        } as Partial<WorkflowStepType>,
      );
      return stepFailed ? ("failed" as const) : ("succeeded" as const);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.workflowStepsRepository.update(
        { id: step.id } as Partial<WorkflowStepType>,
        { status: "failed", error: message } as Partial<WorkflowStepType>,
      );
      return "failed" as const;
    }
  }

  private async runSteps(
    workflowId: string,
    executionMode: "sequential" | "parallel",
  ) {
    const steps = await this.workflowStepsRepository.findByWorkflow(workflowId);
    const blocked = new Set<string>();

    for (const step of steps) {
      if (["failed", "skipped", "cancelled"].includes(step.status))
        blocked.add(step.id);
    }

    const pending = steps.filter((step) => step.status === "pending");
    const runnable: WorkflowStepType[] = [];

    for (const step of pending) {
      if (step.depends_on.some((depId) => blocked.has(depId))) {
        await this.workflowStepsRepository.update(
          { id: step.id } as Partial<WorkflowStepType>,
          { status: "skipped" } as Partial<WorkflowStepType>,
        );
        blocked.add(step.id);
        continue;
      }
      runnable.push(step);
    }

    if (executionMode === "parallel") {
      const parallelGroup = runnable.filter(
        (step) => step.capability?.readOnly && step.depends_on.length === 0,
      );
      const sequentialRest = runnable.filter(
        (step) => !parallelGroup.includes(step),
      );

      await Promise.all(parallelGroup.map((step) => this.runOneStep(step, false)));

      for (const step of sequentialRest) {
        const outcome = await this.runOneStep(step, false);
        if (outcome === "failed" || outcome === "awaiting_approval") break;
      }
    } else {
      for (const step of runnable) {
        const outcome = await this.runOneStep(step, false);
        if (outcome === "failed" || outcome === "awaiting_approval") break;
      }
    }

    await this.settleWorkflowStatus(workflowId);
  }

  private async settleWorkflowStatus(workflowId: string) {
    const steps = await this.workflowStepsRepository.findByWorkflow(workflowId);
    const hasPending = steps.some(
      (step) => step.status === "pending" || step.status === "running",
    );
    const hasFailed = steps.some((step) => step.status === "failed");
    const hasSucceeded = steps.some((step) => step.status === "succeeded");

    let status: WorkflowStatus;
    if (hasPending) status = "approved";
    else if (hasFailed && hasSucceeded) status = "partially_succeeded";
    else if (hasFailed) status = "failed";
    else status = "succeeded";

    await this.workflowsRepository.update(
      { id: workflowId } as Partial<WorkflowType>,
      { status } as Partial<WorkflowType>,
    );
  }
}
