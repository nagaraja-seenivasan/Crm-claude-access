import {
  Count,
  CountSchema,
  Filter,
  repository,
  Where,
} from '@loopback/repository';
import {
  post,
  param,
  get,
  getModelSchemaRef,
  patch,
  del,
  requestBody,
  response,
  HttpErrors,
} from '@loopback/rest';
import {inject} from '@loopback/core';
import {Rule} from '../models/rule.model';
import {RuleExecutionLog} from '../models/rule-execution-log.model';
import {RuleRepository} from '../repositories/rule.repository';
import {RuleExecutionLogRepository} from '../repositories/rule-execution-log.repository';
import {RuleEngineService} from '../services/rule-engine.service';
import {
  ExecuteRulesRequest,
  RuleExecutionResult,
  EntityField,
} from '../types/rule.types';

const ENTITY_FIELDS: Record<string, EntityField[]> = {
  Lead: [
    {label: 'Status', value: 'status', type: 'string'},
    {label: 'Amount', value: 'amount', type: 'number'},
    {label: 'Priority', value: 'priority', type: 'string'},
    {label: 'Owner Email', value: 'owner.email', type: 'string'},
    {label: 'Customer ID', value: 'customerId', type: 'string'},
    {label: 'Created At', value: 'createdAt', type: 'date'},
  ],
  Deal: [
    {label: 'Status', value: 'status', type: 'string'},
    {label: 'Value', value: 'value', type: 'number'},
    {label: 'Stage', value: 'stage', type: 'string'},
    {label: 'Owner Email', value: 'owner.email', type: 'string'},
    {label: 'Close Date', value: 'closeDate', type: 'date'},
  ],
  Contact: [
    {label: 'Email', value: 'email', type: 'string'},
    {label: 'Phone', value: 'phone', type: 'string'},
    {label: 'Status', value: 'status', type: 'string'},
    {label: 'Company', value: 'company', type: 'string'},
  ],
};

export class RuleController {
  constructor(
    @repository(RuleRepository) private ruleRepo: RuleRepository,
    @repository(RuleExecutionLogRepository)
    private logRepo: RuleExecutionLogRepository,
    @inject('services.RuleEngineService')
    private ruleEngine: RuleEngineService,
  ) {}

  @post('/rules')
  @response(200, {
    description: 'Rule model instance',
    content: {'application/json': {schema: getModelSchemaRef(Rule)}},
  })
  async create(
    @requestBody({
      content: {
        'application/json': {schema: getModelSchemaRef(Rule, {exclude: ['id']})},
      },
    })
    rule: Omit<Rule, 'id'>,
  ): Promise<Rule> {
    const now = new Date();
    return this.ruleRepo.create({...rule, createdAt: now, updatedAt: now});
  }

  @get('/rules/count')
  @response(200, {description: 'Rule model count', content: {'application/json': {schema: CountSchema}}})
  async count(@param.where(Rule) where?: Where<Rule>): Promise<Count> {
    return this.ruleRepo.count(where);
  }

  @get('/rules')
  @response(200, {
    description: 'Array of Rule model instances',
    content: {'application/json': {schema: {type: 'array', items: getModelSchemaRef(Rule)}}},
  })
  async find(@param.filter(Rule) filter?: Filter<Rule>): Promise<Rule[]> {
    return this.ruleRepo.find(filter);
  }

  @get('/rules/{id}')
  @response(200, {
    description: 'Rule model instance',
    content: {'application/json': {schema: getModelSchemaRef(Rule)}},
  })
  async findById(@param.path.string('id') id: string): Promise<Rule> {
    const rule = await this.ruleRepo.findById(id);
    if (!rule) throw new HttpErrors.NotFound(`Rule ${id} not found`);
    return rule;
  }

  @patch('/rules/{id}')
  @response(204, {description: 'Rule PATCH success'})
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {'application/json': {schema: getModelSchemaRef(Rule, {partial: true})}},
    })
    rule: Partial<Rule>,
  ): Promise<void> {
    await this.ruleRepo.updateById(id, {...rule, updatedAt: new Date()});
  }

  @patch('/rules/{id}/toggle')
  @response(200, {description: 'Toggle rule active state'})
  async toggle(@param.path.string('id') id: string): Promise<{id: string; isActive: boolean}> {
    const rule = await this.ruleRepo.findById(id);
    if (!rule) throw new HttpErrors.NotFound(`Rule ${id} not found`);
    const isActive = !rule.isActive;
    await this.ruleRepo.updateById(id, {isActive, updatedAt: new Date()});
    return {id, isActive};
  }

  @del('/rules/{id}')
  @response(204, {description: 'Rule DELETE success'})
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.ruleRepo.deleteById(id);
  }

  @post('/rules/execute')
  @response(200, {description: 'Execute rules against a scope object'})
  async execute(
    @requestBody({content: {'application/json': {schema: {type: 'object'}}}})
    body: ExecuteRulesRequest,
  ): Promise<RuleExecutionResult[]> {
    return this.ruleEngine.executeForEntity(
      body.entityType,
      body.triggerType,
      body.scope,
    );
  }

  @get('/rule-execution-logs')
  @response(200, {
    description: 'Array of RuleExecutionLog instances',
    content: {
      'application/json': {
        schema: {type: 'array', items: getModelSchemaRef(RuleExecutionLog)},
      },
    },
  })
  async findLogs(
    @param.filter(RuleExecutionLog) filter?: Filter<RuleExecutionLog>,
  ): Promise<RuleExecutionLog[]> {
    return this.logRepo.find(filter);
  }

  @get('/entity-fields/{entityType}')
  @response(200, {description: 'Fields available for an entity type'})
  async entityFields(
    @param.path.string('entityType') entityType: string,
  ): Promise<EntityField[]> {
    return ENTITY_FIELDS[entityType] ?? [];
  }

  @get('/notification-templates')
  @response(200, {description: 'Available notification templates'})
  async notificationTemplates(): Promise<{id: string; name: string; channel: string}[]> {
    return [
      {id: 'deal-won-template', name: 'Deal Won', channel: 'EMAIL'},
      {id: 'lead-assigned-sms', name: 'Lead Assigned', channel: 'SMS'},
      {id: 'lead-followup-push', name: 'Lead Follow-up', channel: 'PUSH'},
      {id: 'status-change-webhook', name: 'Status Changed', channel: 'WEBHOOK'},
    ];
  }
}
