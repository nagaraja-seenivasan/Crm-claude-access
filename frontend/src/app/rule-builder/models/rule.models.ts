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

export interface RuleNode {
  id: string;
  type: NodeType;
  label: string;
  position: Position;
  data: NodeData;
}

export interface NodeConnection {
  id: string;
  sourceNodeId: string;
  sourcePortId: string;
  targetNodeId: string;
  targetPortId: string;
  label?: string;
}

export interface RuleDefinition {
  id?: string;
  name: string;
  description?: string;
  entityType: string;
  isActive: boolean;
  triggerTypes: TriggerType[];
  nodes: RuleNode[];
  connections: NodeConnection[];
  createdAt?: string;
  updatedAt?: string;
}

export interface PaletteItem {
  type: NodeType;
  label: string;
  description: string;
  icon: string;
  accentVar: string;
  group: 'trigger' | 'logic' | 'action';
}

export interface EntityField {
  label: string;
  value: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'object';
}

export interface NotificationTemplate {
  id: string;
  name: string;
  channel: NotificationChannel;
}

export const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  equals: '=',
  not_equals: '≠',
  greater_than: '>',
  less_than: '<',
  greater_than_or_equal: '≥',
  less_than_or_equal: '≤',
  contains: 'contains',
  starts_with: 'starts with',
  ends_with: 'ends with',
  is_null: 'is null',
  is_not_null: 'is not null',
};

export const PALETTE_ITEMS: PaletteItem[] = [
  {
    type: 'trigger',
    label: 'SQS Trigger',
    description: 'Fires when an SQS message arrives',
    icon: 'pi-bolt',
    accentVar: '--rb-node-trigger-accent',
    group: 'trigger',
  },
  {
    type: 'trigger',
    label: 'Record Save',
    description: 'Fires when an entity is saved',
    icon: 'pi-save',
    accentVar: '--rb-node-trigger-accent',
    group: 'trigger',
  },
  {
    type: 'condition',
    label: 'Condition',
    description: 'Branch on field comparison',
    icon: 'pi-sitemap',
    accentVar: '--rb-node-condition-accent',
    group: 'logic',
  },
  {
    type: 'set-value',
    label: 'Set Value',
    description: 'Assign fields and save entity',
    icon: 'pi-pencil',
    accentVar: '--rb-node-setvalue-accent',
    group: 'action',
  },
  {
    type: 'notification',
    label: 'Notification',
    description: 'Send Email / SMS / Push / Webhook',
    icon: 'pi-bell',
    accentVar: '--rb-node-notification-accent',
    group: 'action',
  },
  {
    type: 'end',
    label: 'End',
    description: 'Terminate this flow branch',
    icon: 'pi-stop-circle',
    accentVar: '--rb-node-end-accent',
    group: 'action',
  },
];
