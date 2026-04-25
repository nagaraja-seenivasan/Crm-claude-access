import {Injectable} from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {Observable} from 'rxjs';
import {
  RuleDefinition,
  EntityField,
  NotificationTemplate,
} from '../models/rule.models';

export interface ExecuteRuleRequest {
  entityType: string;
  triggerType: string;
  scope: Record<string, unknown>;
}

export interface ExecuteRuleResult {
  ruleId: string;
  ruleName: string;
  outcome: 'completed' | 'failed' | 'skipped';
  nodesExecuted: string[];
  scopeAfter: Record<string, unknown>;
  errorMessage?: string;
}

@Injectable({providedIn: 'root'})
export class RuleBuilderService {
  private readonly base = '/api';

  constructor(private http: HttpClient) {}

  listRules(entityType?: string, isActive?: boolean): Observable<RuleDefinition[]> {
    let params = new HttpParams();
    if (entityType) {
      params = params.set('filter', JSON.stringify({where: {entityType}}));
    }
    if (isActive !== undefined) {
      params = params.set('filter', JSON.stringify({where: {isActive}}));
    }
    return this.http.get<RuleDefinition[]>(`${this.base}/rules`, {params});
  }

  getRule(id: string): Observable<RuleDefinition> {
    return this.http.get<RuleDefinition>(`${this.base}/rules/${id}`);
  }

  saveRule(rule: RuleDefinition): Observable<RuleDefinition> {
    if (rule.id) {
      return this.http.patch<RuleDefinition>(`${this.base}/rules/${rule.id}`, rule);
    }
    return this.http.post<RuleDefinition>(`${this.base}/rules`, rule);
  }

  deleteRule(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/rules/${id}`);
  }

  toggleRule(id: string): Observable<{id: string; isActive: boolean}> {
    return this.http.patch<{id: string; isActive: boolean}>(
      `${this.base}/rules/${id}/toggle`,
      {},
    );
  }

  executeTest(req: ExecuteRuleRequest): Observable<ExecuteRuleResult[]> {
    return this.http.post<ExecuteRuleResult[]>(`${this.base}/rules/execute`, req);
  }

  getEntityFields(entityType: string): Observable<EntityField[]> {
    return this.http.get<EntityField[]>(`${this.base}/entity-fields/${entityType}`);
  }

  getNotificationTemplates(): Observable<NotificationTemplate[]> {
    return this.http.get<NotificationTemplate[]>(`${this.base}/notification-templates`);
  }
}
