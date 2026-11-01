import {Entity, model, property} from '@loopback/repository';
import {TriggerType} from '../types/rule.types';

@model({
  settings: {
    strict: true,
    mysql: {table: 'rule_execution_log'},
  },
})
export class RuleExecutionLog extends Entity {
  @property({
    type: 'string',
    id: true,
    defaultFn: 'uuidv4',
    mysql: {columnName: 'id', dataType: 'char', dataLength: 36, nullable: 'N'},
  })
  id?: string;

  @property({type: 'string', required: true, mysql: {columnName: 'rule_id', dataType: 'char', dataLength: 36}})
  ruleId!: string;

  @property({type: 'string', required: true, mysql: {columnName: 'rule_name', dataType: 'varchar', dataLength: 255}})
  ruleName!: string;

  @property({type: 'string', required: true, mysql: {columnName: 'entity_type', dataType: 'varchar', dataLength: 64}})
  entityType!: string;

  @property({type: 'string', mysql: {columnName: 'entity_id', dataType: 'varchar', dataLength: 64, nullable: 'Y'}})
  entityId?: string;

  @property({type: 'string', required: true, mysql: {columnName: 'trigger_type', dataType: 'varchar', dataLength: 32}})
  triggerType!: TriggerType;

  @property({type: 'string', required: true, mysql: {columnName: 'outcome', dataType: 'varchar', dataLength: 16}})
  outcome!: 'completed' | 'failed' | 'skipped';

  @property({
    type: 'array',
    itemType: 'string',
    default: [],
    mysql: {columnName: 'nodes_executed', dataType: 'json'},
  })
  nodesExecuted!: string[];

  @property({type: 'string', mysql: {columnName: 'error_message', dataType: 'text', nullable: 'Y'}})
  errorMessage?: string;

  @property({type: 'object', mysql: {columnName: 'scope_snapshot', dataType: 'json', nullable: 'Y'}})
  scopeSnapshot?: Record<string, unknown>;

  @property({
    type: 'date',
    defaultFn: 'now',
    mysql: {columnName: 'executed_at', dataType: 'datetime', precision: 3},
  })
  executedAt?: Date;

  // No defaults here: repositories build an instance from partial updates
  // (PATCH, toggle), so constructor defaults would overwrite stored values.
  // Create-time defaults come from the @property `default` settings.
  constructor(data?: Partial<RuleExecutionLog>) {
    super(data);
  }
}

export interface RuleExecutionLogRelations {}

export type RuleExecutionLogWithRelations = RuleExecutionLog &
  RuleExecutionLogRelations;
