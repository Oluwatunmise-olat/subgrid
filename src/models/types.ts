export type McpTransport = 'stdio' | 'sse' | 'http';
export type McpHealth = 'unknown' | 'healthy' | 'unreachable';
export type ResourceCategory = 'storage' | 'paas' | 'dns' | 'email' | 'database' | 'other';
export type McpApprovalPolicy = 'auto' | 'prompt' | 'always';
export type McpToolFilter = { include?: string[]; exclude?: string[] } | null;
export type McpServerSecrets = {
	env: Record<string, string> | null;
	headers: Record<string, string> | null;
};

export type ActionLogStatus = 'pending_approval' | 'approved' | 'rejected' | 'succeeded' | 'failed';

export type WorkflowStatus =
	| 'draft'
	| 'awaiting_approval'
	| 'approved'
	| 'running'
	| 'succeeded'
	| 'partially_succeeded'
	| 'failed'
	| 'cancelled';
export type WorkflowMode = 'query' | 'plan';
export type WorkflowExecutionMode = 'sequential' | 'parallel';

export type WorkflowStepStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped' | 'cancelled';
