import {injectable, inject} from '@loopback/core';
import {repository, Where} from '@loopback/repository';
import {RuleRepository} from '../repositories/rule.repository';
import {RuleExecutionLogRepository} from '../repositories/rule-execution-log.repository';
import {Rule} from '../models/rule.model';
import {
  TriggerType,
  NodeType,
  RuleNodeSchema,
  NodeConnectionSchema,
  ConditionNodeData,
  ConditionClause,
  ConditionOperator,
  SetValueNodeData,
  NotificationNodeData,
  RuleExecutionResult,
} from '../types/rule.types';
import {NotificationService} from './notification.service';

@injectable()
export class RuleEngineService {
  constructor(
    @repository(RuleRepository) private ruleRepo: RuleRepository,
    @repository(RuleExecutionLogRepository)
    private logRepo: RuleExecutionLogRepository,
    @inject('services.NotificationService')
    private notificationService: NotificationService,
  ) {}

  async executeForEntity(
    entityType: string,
    triggerType: TriggerType,
    scope: Record<string, unknown>,
  ): Promise<RuleExecutionResult[]> {
    const where: Where<Rule> = {isActive: true, entityType} as Where<Rule>;
    const rules = await this.ruleRepo.find({where});

    const matchingRules = rules.filter(r => r.triggerTypes.includes(triggerType));

    const results: RuleExecutionResult[] = [];
    for (const rule of matchingRules) {
      const result = await this.executeRule(rule, triggerType, {...scope});
      results.push(result);
    }
    return results;
  }

  async executeRule(
    rule: Rule,
    triggerType: TriggerType,
    scope: Record<string, unknown>,
  ): Promise<RuleExecutionResult> {
    const nodesExecuted: string[] = [];
    let outcome: 'completed' | 'failed' | 'skipped' = 'completed';
    let errorMessage: string | undefined;

    try {
      const triggerNode = rule.nodes.find(n => n.type === 'trigger');
      if (!triggerNode) {
        return this.buildResult(rule, triggerType, 'skipped', [], scope, 'No trigger node found');
      }

      await this.walkNode(triggerNode, rule, scope, nodesExecuted);
    } catch (err: unknown) {
      outcome = 'failed';
      errorMessage = err instanceof Error ? err.message : String(err);
    }

    await this.persistLog(rule, triggerType, scope, outcome, nodesExecuted, errorMessage);

    return this.buildResult(rule, triggerType, outcome, nodesExecuted, scope, errorMessage);
  }

  private async walkNode(
    node: RuleNodeSchema,
    rule: Rule,
    scope: Record<string, unknown>,
    trace: string[],
  ): Promise<void> {
    trace.push(node.id);

    switch (node.type as NodeType) {
      case 'trigger':
        await this.proceedToNext(node, rule, scope, trace, true);
        break;

      case 'condition': {
        const condData = node.data as ConditionNodeData;
        const result = this.evaluateCondition(condData, scope);
        await this.proceedToNext(node, rule, scope, trace, result);
        break;
      }

      case 'set-value': {
        const svData = node.data as SetValueNodeData;
        this.applySetValue(svData, scope);
        if (svData.saveEntity) {
          await this.persistEntityUpdate(scope);
        }
        await this.proceedToNext(node, rule, scope, trace, true);
        break;
      }

      case 'notification': {
        const notifData = node.data as NotificationNodeData;
        await this.notificationService.send(notifData, scope);
        await this.proceedToNext(node, rule, scope, trace, true);
        break;
      }

      case 'end':
        break;
    }
  }

  private async proceedToNext(
    node: RuleNodeSchema,
    rule: Rule,
    scope: Record<string, unknown>,
    trace: string[],
    conditionResult: boolean,
  ): Promise<void> {
    const outgoingConnections = rule.connections.filter(
      c => c.sourceNodeId === node.id,
    );

    for (const conn of outgoingConnections) {
      if (node.type === 'condition') {
        const isTrue = conn.sourcePortId === 'output-true' || conn.label === 'TRUE';
        const isFalse = conn.sourcePortId === 'output-false' || conn.label === 'FALSE';
        if (isTrue && !conditionResult) continue;
        if (isFalse && conditionResult) continue;
      }

      const nextNode = rule.nodes.find(n => n.id === conn.targetNodeId);
      if (nextNode) {
        await this.walkNode(nextNode, rule, scope, trace);
      }
    }
  }

  private evaluateCondition(
    data: ConditionNodeData,
    scope: Record<string, unknown>,
  ): boolean {
    if (data.conditions && data.conditions.length > 0) {
      const results = data.conditions.map(c => this.evaluateClause(c, scope));
      return data.logicalOperator === 'OR'
        ? results.some(Boolean)
        : results.every(Boolean);
    }
    return this.evaluateClause(
      {field: data.field, operator: data.operator, value: data.value},
      scope,
    );
  }

  private evaluateClause(
    clause: ConditionClause,
    scope: Record<string, unknown>,
  ): boolean {
    const fieldValue = this.getNestedValue(scope, clause.field);
    const op = clause.operator as ConditionOperator;

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

  private applySetValue(
    data: SetValueNodeData,
    scope: Record<string, unknown>,
  ): void {
    for (const assignment of data.assignments) {
      const resolved = assignment.isExpression
        ? this.interpolate(String(assignment.value), scope)
        : assignment.value;
      this.setNestedValue(scope, assignment.targetField, resolved);
    }
  }

  private interpolate(
    template: string,
    scope: Record<string, unknown>,
  ): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
      const val = this.getNestedValue(scope, path.trim());
      return val != null ? String(val) : '';
    });
  }

  private getNestedValue(
    obj: Record<string, unknown>,
    path: string,
  ): unknown {
    return path.split('.').reduce((acc: unknown, key) => {
      if (acc !== null && typeof acc === 'object') {
        return (acc as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj as unknown);
  }

  private setNestedValue(
    obj: Record<string, unknown>,
    path: string,
    value: unknown,
  ): void {
    const parts = path.split('.');
    let current: Record<string, unknown> = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const key = parts[i];
      if (typeof current[key] !== 'object' || current[key] === null) {
        current[key] = {};
      }
      current = current[key] as Record<string, unknown>;
    }
    current[parts[parts.length - 1]] = value;
  }

  private async persistEntityUpdate(
    scope: Record<string, unknown>,
  ): Promise<void> {
    // Hook into entity-specific repository as needed.
    // For now this is a no-op placeholder — callers inject their own save logic.
    void scope;
  }

  private async persistLog(
    rule: Rule,
    triggerType: TriggerType,
    scope: Record<string, unknown>,
    outcome: 'completed' | 'failed' | 'skipped',
    nodesExecuted: string[],
    errorMessage?: string,
  ): Promise<void> {
    await this.logRepo.create({
      ruleId: rule.id ?? '',
      ruleName: rule.name,
      entityType: rule.entityType,
      entityId: String(scope['id'] ?? ''),
      triggerType,
      outcome,
      nodesExecuted,
      errorMessage,
      scopeSnapshot: scope,
    });
  }

  private buildResult(
    rule: Rule,
    triggerType: TriggerType,
    outcome: 'completed' | 'failed' | 'skipped',
    nodesExecuted: string[],
    scope: Record<string, unknown>,
    errorMessage?: string,
  ): RuleExecutionResult {
    void triggerType;
    return {
      ruleId: rule.id ?? '',
      ruleName: rule.name,
      outcome,
      nodesExecuted,
      scopeAfter: scope,
      errorMessage,
    };
  }
}
