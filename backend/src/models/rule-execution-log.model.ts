import {Entity, model, property} from '@loopback/repository';
import {TriggerType} from '../types/rule.types';

@model({
  settings: {
    strict: false,
    mongodb: {collection: 'ruleExecutionLogs'},
  },
})
export class RuleExecutionLog extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: true,
    mongodb: {dataType: 'ObjectID'},
  })
  id?: string;

  @property({type: 'string', required: true})
  ruleId: string;

  @property({type: 'string', required: true})
  ruleName: string;

  @property({type: 'string', required: true})
  entityType: string;

  @property({type: 'string'})
  entityId?: string;

  @property({type: 'string', required: true})
  triggerType: TriggerType;

  @property({type: 'string', required: true})
  outcome: 'completed' | 'failed' | 'skipped';

  @property({
    type: 'array',
    itemType: 'string',
    default: [],
  })
  nodesExecuted: string[];

  @property({type: 'string'})
  errorMessage?: string;

  @property({type: 'object'})
  scopeSnapshot?: Record<string, unknown>;

  @property({type: 'date', defaultFn: 'now'})
  executedAt?: Date;

  constructor(data?: Partial<RuleExecutionLog>) {
    super(data);
    this.ruleId = data?.ruleId ?? '';
    this.ruleName = data?.ruleName ?? '';
    this.entityType = data?.entityType ?? '';
    this.triggerType = data?.triggerType ?? 'RECORD_SAVE';
    this.outcome = data?.outcome ?? 'completed';
    this.nodesExecuted = data?.nodesExecuted ?? [];
  }
}

export interface RuleExecutionLogRelations {}

export type RuleExecutionLogWithRelations = RuleExecutionLog &
  RuleExecutionLogRelations;
