import { Count, Filter, Where } from '@loopback/repository';
import { Rule } from '../models/rule.model';
import { RuleExecutionLog } from '../models/rule-execution-log.model';
import { RuleRepository } from '../repositories/rule.repository';
import { RuleExecutionLogRepository } from '../repositories/rule-execution-log.repository';
import { RuleEngineService } from '../services/rule-engine.service';
import { ExecuteRulesRequest, RuleExecutionResult, EntityField } from '../types/rule.types';
export declare class RuleController {
    private ruleRepo;
    private logRepo;
    private ruleEngine;
    constructor(ruleRepo: RuleRepository, logRepo: RuleExecutionLogRepository, ruleEngine: RuleEngineService);
    create(rule: Omit<Rule, 'id'>): Promise<Rule>;
    count(where?: Where<Rule>): Promise<Count>;
    find(filter?: Filter<Rule>): Promise<Rule[]>;
    findById(id: string): Promise<Rule>;
    updateById(id: string, rule: Partial<Rule>): Promise<void>;
    toggle(id: string): Promise<{
        id: string;
        isActive: boolean;
    }>;
    deleteById(id: string): Promise<void>;
    execute(body: ExecuteRulesRequest): Promise<RuleExecutionResult[]>;
    findLogs(filter?: Filter<RuleExecutionLog>): Promise<RuleExecutionLog[]>;
    entityFields(entityType: string): Promise<EntityField[]>;
    notificationTemplates(): Promise<{
        id: string;
        name: string;
        channel: string;
    }[]>;
}
