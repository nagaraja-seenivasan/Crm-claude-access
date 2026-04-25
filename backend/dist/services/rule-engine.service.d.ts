import { RuleRepository } from '../repositories/rule.repository';
import { RuleExecutionLogRepository } from '../repositories/rule-execution-log.repository';
import { Rule } from '../models/rule.model';
import { TriggerType, RuleExecutionResult } from '../types/rule.types';
import { NotificationService } from './notification.service';
export declare class RuleEngineService {
    private ruleRepo;
    private logRepo;
    private notificationService;
    constructor(ruleRepo: RuleRepository, logRepo: RuleExecutionLogRepository, notificationService: NotificationService);
    executeForEntity(entityType: string, triggerType: TriggerType, scope: Record<string, unknown>): Promise<RuleExecutionResult[]>;
    executeRule(rule: Rule, triggerType: TriggerType, scope: Record<string, unknown>): Promise<RuleExecutionResult>;
    private walkNode;
    private proceedToNext;
    private evaluateCondition;
    private evaluateClause;
    private applySetValue;
    private interpolate;
    private getNestedValue;
    private setNestedValue;
    private persistEntityUpdate;
    private persistLog;
    private buildResult;
}
