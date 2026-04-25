"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuleEngineService = void 0;
const tslib_1 = require("tslib");
const core_1 = require("@loopback/core");
const repository_1 = require("@loopback/repository");
const rule_repository_1 = require("../repositories/rule.repository");
const rule_execution_log_repository_1 = require("../repositories/rule-execution-log.repository");
const notification_service_1 = require("./notification.service");
let RuleEngineService = class RuleEngineService {
    constructor(ruleRepo, logRepo, notificationService) {
        this.ruleRepo = ruleRepo;
        this.logRepo = logRepo;
        this.notificationService = notificationService;
    }
    async executeForEntity(entityType, triggerType, scope) {
        const where = { isActive: true, entityType };
        const rules = await this.ruleRepo.find({ where });
        const matchingRules = rules.filter(r => r.triggerTypes.includes(triggerType));
        const results = [];
        for (const rule of matchingRules) {
            const result = await this.executeRule(rule, triggerType, { ...scope });
            results.push(result);
        }
        return results;
    }
    async executeRule(rule, triggerType, scope) {
        const nodesExecuted = [];
        let outcome = 'completed';
        let errorMessage;
        try {
            const triggerNode = rule.nodes.find(n => n.type === 'trigger');
            if (!triggerNode) {
                return this.buildResult(rule, triggerType, 'skipped', [], scope, 'No trigger node found');
            }
            await this.walkNode(triggerNode, rule, scope, nodesExecuted);
        }
        catch (err) {
            outcome = 'failed';
            errorMessage = err instanceof Error ? err.message : String(err);
        }
        await this.persistLog(rule, triggerType, scope, outcome, nodesExecuted, errorMessage);
        return this.buildResult(rule, triggerType, outcome, nodesExecuted, scope, errorMessage);
    }
    async walkNode(node, rule, scope, trace) {
        trace.push(node.id);
        switch (node.type) {
            case 'trigger':
                await this.proceedToNext(node, rule, scope, trace, true);
                break;
            case 'condition': {
                const condData = node.data;
                const result = this.evaluateCondition(condData, scope);
                await this.proceedToNext(node, rule, scope, trace, result);
                break;
            }
            case 'set-value': {
                const svData = node.data;
                this.applySetValue(svData, scope);
                if (svData.saveEntity) {
                    await this.persistEntityUpdate(scope);
                }
                await this.proceedToNext(node, rule, scope, trace, true);
                break;
            }
            case 'notification': {
                const notifData = node.data;
                await this.notificationService.send(notifData, scope);
                await this.proceedToNext(node, rule, scope, trace, true);
                break;
            }
            case 'end':
                break;
        }
    }
    async proceedToNext(node, rule, scope, trace, conditionResult) {
        const outgoingConnections = rule.connections.filter(c => c.sourceNodeId === node.id);
        for (const conn of outgoingConnections) {
            if (node.type === 'condition') {
                const isTrue = conn.sourcePortId === 'output-true' || conn.label === 'TRUE';
                const isFalse = conn.sourcePortId === 'output-false' || conn.label === 'FALSE';
                if (isTrue && !conditionResult)
                    continue;
                if (isFalse && conditionResult)
                    continue;
            }
            const nextNode = rule.nodes.find(n => n.id === conn.targetNodeId);
            if (nextNode) {
                await this.walkNode(nextNode, rule, scope, trace);
            }
        }
    }
    evaluateCondition(data, scope) {
        if (data.conditions && data.conditions.length > 0) {
            const results = data.conditions.map(c => this.evaluateClause(c, scope));
            return data.logicalOperator === 'OR'
                ? results.some(Boolean)
                : results.every(Boolean);
        }
        return this.evaluateClause({ field: data.field, operator: data.operator, value: data.value }, scope);
    }
    evaluateClause(clause, scope) {
        const fieldValue = this.getNestedValue(scope, clause.field);
        const op = clause.operator;
        switch (op) {
            case 'equals':
                return fieldValue == clause.value;
            case 'not_equals':
                return fieldValue != clause.value;
            case 'greater_than':
                return Number(fieldValue) > Number(clause.value);
            case 'less_than':
                return Number(fieldValue) < Number(clause.value);
            case 'greater_than_or_equal':
                return Number(fieldValue) >= Number(clause.value);
            case 'less_than_or_equal':
                return Number(fieldValue) <= Number(clause.value);
            case 'contains':
                return String(fieldValue).includes(String(clause.value));
            case 'starts_with':
                return String(fieldValue).startsWith(String(clause.value));
            case 'ends_with':
                return String(fieldValue).endsWith(String(clause.value));
            case 'is_null':
                return fieldValue == null;
            case 'is_not_null':
                return fieldValue != null;
            default:
                return false;
        }
    }
    applySetValue(data, scope) {
        for (const assignment of data.assignments) {
            const resolved = assignment.isExpression
                ? this.interpolate(String(assignment.value), scope)
                : assignment.value;
            this.setNestedValue(scope, assignment.targetField, resolved);
        }
    }
    interpolate(template, scope) {
        return template.replace(/\{\{([^}]+)\}\}/g, (_, path) => {
            const val = this.getNestedValue(scope, path.trim());
            return val != null ? String(val) : '';
        });
    }
    getNestedValue(obj, path) {
        return path.split('.').reduce((acc, key) => {
            if (acc !== null && typeof acc === 'object') {
                return acc[key];
            }
            return undefined;
        }, obj);
    }
    setNestedValue(obj, path, value) {
        const parts = path.split('.');
        let current = obj;
        for (let i = 0; i < parts.length - 1; i++) {
            const key = parts[i];
            if (typeof current[key] !== 'object' || current[key] === null) {
                current[key] = {};
            }
            current = current[key];
        }
        current[parts[parts.length - 1]] = value;
    }
    async persistEntityUpdate(scope) {
        // Hook into entity-specific repository as needed.
        // For now this is a no-op placeholder — callers inject their own save logic.
        void scope;
    }
    async persistLog(rule, triggerType, scope, outcome, nodesExecuted, errorMessage) {
        var _a, _b;
        await this.logRepo.create({
            ruleId: (_a = rule.id) !== null && _a !== void 0 ? _a : '',
            ruleName: rule.name,
            entityType: rule.entityType,
            entityId: String((_b = scope['id']) !== null && _b !== void 0 ? _b : ''),
            triggerType,
            outcome,
            nodesExecuted,
            errorMessage,
            scopeSnapshot: scope,
        });
    }
    buildResult(rule, triggerType, outcome, nodesExecuted, scope, errorMessage) {
        var _a;
        void triggerType;
        return {
            ruleId: (_a = rule.id) !== null && _a !== void 0 ? _a : '',
            ruleName: rule.name,
            outcome,
            nodesExecuted,
            scopeAfter: scope,
            errorMessage,
        };
    }
};
exports.RuleEngineService = RuleEngineService;
exports.RuleEngineService = RuleEngineService = tslib_1.__decorate([
    (0, core_1.injectable)(),
    tslib_1.__param(0, (0, repository_1.repository)(rule_repository_1.RuleRepository)),
    tslib_1.__param(1, (0, repository_1.repository)(rule_execution_log_repository_1.RuleExecutionLogRepository)),
    tslib_1.__param(2, (0, core_1.inject)('services.NotificationService')),
    tslib_1.__metadata("design:paramtypes", [rule_repository_1.RuleRepository,
        rule_execution_log_repository_1.RuleExecutionLogRepository,
        notification_service_1.NotificationService])
], RuleEngineService);
//# sourceMappingURL=rule-engine.service.js.map