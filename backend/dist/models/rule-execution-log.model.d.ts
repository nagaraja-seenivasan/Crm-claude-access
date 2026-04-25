import { Entity } from '@loopback/repository';
import { TriggerType } from '../types/rule.types';
export declare class RuleExecutionLog extends Entity {
    id?: string;
    ruleId: string;
    ruleName: string;
    entityType: string;
    entityId?: string;
    triggerType: TriggerType;
    outcome: 'completed' | 'failed' | 'skipped';
    nodesExecuted: string[];
    errorMessage?: string;
    scopeSnapshot?: Record<string, unknown>;
    executedAt?: Date;
    constructor(data?: Partial<RuleExecutionLog>);
}
export interface RuleExecutionLogRelations {
}
export type RuleExecutionLogWithRelations = RuleExecutionLog & RuleExecutionLogRelations;
