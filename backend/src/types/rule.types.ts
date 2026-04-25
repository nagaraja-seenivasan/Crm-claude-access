export type TriggerType = 'SQS' | 'RECORD_SAVE';

export type NodeType = 'trigger' | 'condition' | 'set-value' | 'notification' | 'end';

export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'less_than'
  | 'greater_than_or_equal'
  | 'less_than_or_equal'
  | 'contains'
  | 'starts_with'
  | 'ends_with'
  | 'is_null'
  | 'is_not_null';

export type NotificationChannel = 'EMAIL' | 'SMS' | 'PUSH' | 'WEBHOOK';

export type LogicalOperator = 'AND' | 'OR';

export interface Position {
  x: number;
  y: number;
}

export interface TriggerNodeData {
  triggerType: TriggerType;
  entityType: string;
  sqsQueueName?: string;
}

export interface ConditionClause {
  field: string;
  operator: ConditionOperator;
  value: unknown;
}

export interface ConditionNodeData {
  field: string;
  operator: ConditionOperator;
  value: unknown;
  logicalOperator?: LogicalOperator;
  conditions?: ConditionClause[];
}

export interface ValueAssignment {
  targetField: string;
  value: unknown;
  isExpression: boolean;
}

export interface SetValueNodeData {
  assignments: ValueAssignment[];
  saveEntity: boolean;
}

export interface NotificationNodeData {
  channel: NotificationChannel;
  templateId: string;
  subject?: string;
  recipientField: string;
  additionalRecipients?: string[];
}

export type NodeData =
  | TriggerNodeData
  | ConditionNodeData
  | SetValueNodeData
  | NotificationNodeData
  | Record<string, unknown>;

export interface RuleNodeSchema {
  id: string;
  type: NodeType;
  label: string;
  position: Position;
  data: NodeData;
}

export interface NodeConnectionSchema {
  id: string;
  sourceNodeId: string;
  sourcePortId: string;
  targetNodeId: string;
  targetPortId: string;
  label?: string;
}

export interface ExecuteRulesRequest {
  entityType: string;
  triggerType: TriggerType;
  scope: Record<string, unknown>;
}

export interface RuleExecutionResult {
  ruleId: string;
  ruleName: string;
  outcome: 'completed' | 'failed' | 'skipped';
  nodesExecuted: string[];
  scopeAfter: Record<string, unknown>;
  errorMessage?: string;
}

export interface SqsMessagePayload {
  entityType: string;
  entityId: string;
  triggerType: TriggerType;
  payload: Record<string, unknown>;
}

export interface EntityField {
  label: string;
  value: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'object';
}
