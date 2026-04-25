"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuleController = void 0;
const tslib_1 = require("tslib");
const repository_1 = require("@loopback/repository");
const rest_1 = require("@loopback/rest");
const core_1 = require("@loopback/core");
const rule_model_1 = require("../models/rule.model");
const rule_execution_log_model_1 = require("../models/rule-execution-log.model");
const rule_repository_1 = require("../repositories/rule.repository");
const rule_execution_log_repository_1 = require("../repositories/rule-execution-log.repository");
const rule_engine_service_1 = require("../services/rule-engine.service");
const ENTITY_FIELDS = {
    Lead: [
        { label: 'Status', value: 'status', type: 'string' },
        { label: 'Amount', value: 'amount', type: 'number' },
        { label: 'Priority', value: 'priority', type: 'string' },
        { label: 'Owner Email', value: 'owner.email', type: 'string' },
        { label: 'Customer ID', value: 'customerId', type: 'string' },
        { label: 'Created At', value: 'createdAt', type: 'date' },
    ],
    Deal: [
        { label: 'Status', value: 'status', type: 'string' },
        { label: 'Value', value: 'value', type: 'number' },
        { label: 'Stage', value: 'stage', type: 'string' },
        { label: 'Owner Email', value: 'owner.email', type: 'string' },
        { label: 'Close Date', value: 'closeDate', type: 'date' },
    ],
    Contact: [
        { label: 'Email', value: 'email', type: 'string' },
        { label: 'Phone', value: 'phone', type: 'string' },
        { label: 'Status', value: 'status', type: 'string' },
        { label: 'Company', value: 'company', type: 'string' },
    ],
};
let RuleController = class RuleController {
    constructor(ruleRepo, logRepo, ruleEngine) {
        this.ruleRepo = ruleRepo;
        this.logRepo = logRepo;
        this.ruleEngine = ruleEngine;
    }
    async create(rule) {
        const now = new Date();
        return this.ruleRepo.create({ ...rule, createdAt: now, updatedAt: now });
    }
    async count(where) {
        return this.ruleRepo.count(where);
    }
    async find(filter) {
        return this.ruleRepo.find(filter);
    }
    async findById(id) {
        const rule = await this.ruleRepo.findById(id);
        if (!rule)
            throw new rest_1.HttpErrors.NotFound(`Rule ${id} not found`);
        return rule;
    }
    async updateById(id, rule) {
        await this.ruleRepo.updateById(id, { ...rule, updatedAt: new Date() });
    }
    async toggle(id) {
        const rule = await this.ruleRepo.findById(id);
        if (!rule)
            throw new rest_1.HttpErrors.NotFound(`Rule ${id} not found`);
        const isActive = !rule.isActive;
        await this.ruleRepo.updateById(id, { isActive, updatedAt: new Date() });
        return { id, isActive };
    }
    async deleteById(id) {
        await this.ruleRepo.deleteById(id);
    }
    async execute(body) {
        return this.ruleEngine.executeForEntity(body.entityType, body.triggerType, body.scope);
    }
    async findLogs(filter) {
        return this.logRepo.find(filter);
    }
    async entityFields(entityType) {
        var _a;
        return (_a = ENTITY_FIELDS[entityType]) !== null && _a !== void 0 ? _a : [];
    }
    async notificationTemplates() {
        return [
            { id: 'deal-won-template', name: 'Deal Won', channel: 'EMAIL' },
            { id: 'lead-assigned-sms', name: 'Lead Assigned', channel: 'SMS' },
            { id: 'lead-followup-push', name: 'Lead Follow-up', channel: 'PUSH' },
            { id: 'status-change-webhook', name: 'Status Changed', channel: 'WEBHOOK' },
        ];
    }
};
exports.RuleController = RuleController;
tslib_1.__decorate([
    (0, rest_1.post)('/rules'),
    (0, rest_1.response)(200, {
        description: 'Rule model instance',
        content: { 'application/json': { schema: (0, rest_1.getModelSchemaRef)(rule_model_1.Rule) } },
    }),
    tslib_1.__param(0, (0, rest_1.requestBody)({
        content: {
            'application/json': { schema: (0, rest_1.getModelSchemaRef)(rule_model_1.Rule, { exclude: ['id'] }) },
        },
    })),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [Object]),
    tslib_1.__metadata("design:returntype", Promise)
], RuleController.prototype, "create", null);
tslib_1.__decorate([
    (0, rest_1.get)('/rules/count'),
    (0, rest_1.response)(200, { description: 'Rule model count', content: { 'application/json': { schema: repository_1.CountSchema } } }),
    tslib_1.__param(0, rest_1.param.where(rule_model_1.Rule)),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [Object]),
    tslib_1.__metadata("design:returntype", Promise)
], RuleController.prototype, "count", null);
tslib_1.__decorate([
    (0, rest_1.get)('/rules'),
    (0, rest_1.response)(200, {
        description: 'Array of Rule model instances',
        content: { 'application/json': { schema: { type: 'array', items: (0, rest_1.getModelSchemaRef)(rule_model_1.Rule) } } },
    }),
    tslib_1.__param(0, rest_1.param.filter(rule_model_1.Rule)),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [Object]),
    tslib_1.__metadata("design:returntype", Promise)
], RuleController.prototype, "find", null);
tslib_1.__decorate([
    (0, rest_1.get)('/rules/{id}'),
    (0, rest_1.response)(200, {
        description: 'Rule model instance',
        content: { 'application/json': { schema: (0, rest_1.getModelSchemaRef)(rule_model_1.Rule) } },
    }),
    tslib_1.__param(0, rest_1.param.path.string('id')),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [String]),
    tslib_1.__metadata("design:returntype", Promise)
], RuleController.prototype, "findById", null);
tslib_1.__decorate([
    (0, rest_1.patch)('/rules/{id}'),
    (0, rest_1.response)(204, { description: 'Rule PATCH success' }),
    tslib_1.__param(0, rest_1.param.path.string('id')),
    tslib_1.__param(1, (0, rest_1.requestBody)({
        content: { 'application/json': { schema: (0, rest_1.getModelSchemaRef)(rule_model_1.Rule, { partial: true }) } },
    })),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [String, Object]),
    tslib_1.__metadata("design:returntype", Promise)
], RuleController.prototype, "updateById", null);
tslib_1.__decorate([
    (0, rest_1.patch)('/rules/{id}/toggle'),
    (0, rest_1.response)(200, { description: 'Toggle rule active state' }),
    tslib_1.__param(0, rest_1.param.path.string('id')),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [String]),
    tslib_1.__metadata("design:returntype", Promise)
], RuleController.prototype, "toggle", null);
tslib_1.__decorate([
    (0, rest_1.del)('/rules/{id}'),
    (0, rest_1.response)(204, { description: 'Rule DELETE success' }),
    tslib_1.__param(0, rest_1.param.path.string('id')),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [String]),
    tslib_1.__metadata("design:returntype", Promise)
], RuleController.prototype, "deleteById", null);
tslib_1.__decorate([
    (0, rest_1.post)('/rules/execute'),
    (0, rest_1.response)(200, { description: 'Execute rules against a scope object' }),
    tslib_1.__param(0, (0, rest_1.requestBody)({ content: { 'application/json': { schema: { type: 'object' } } } })),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [Object]),
    tslib_1.__metadata("design:returntype", Promise)
], RuleController.prototype, "execute", null);
tslib_1.__decorate([
    (0, rest_1.get)('/rule-execution-logs'),
    (0, rest_1.response)(200, {
        description: 'Array of RuleExecutionLog instances',
        content: {
            'application/json': {
                schema: { type: 'array', items: (0, rest_1.getModelSchemaRef)(rule_execution_log_model_1.RuleExecutionLog) },
            },
        },
    }),
    tslib_1.__param(0, rest_1.param.filter(rule_execution_log_model_1.RuleExecutionLog)),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [Object]),
    tslib_1.__metadata("design:returntype", Promise)
], RuleController.prototype, "findLogs", null);
tslib_1.__decorate([
    (0, rest_1.get)('/entity-fields/{entityType}'),
    (0, rest_1.response)(200, { description: 'Fields available for an entity type' }),
    tslib_1.__param(0, rest_1.param.path.string('entityType')),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [String]),
    tslib_1.__metadata("design:returntype", Promise)
], RuleController.prototype, "entityFields", null);
tslib_1.__decorate([
    (0, rest_1.get)('/notification-templates'),
    (0, rest_1.response)(200, { description: 'Available notification templates' }),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", []),
    tslib_1.__metadata("design:returntype", Promise)
], RuleController.prototype, "notificationTemplates", null);
exports.RuleController = RuleController = tslib_1.__decorate([
    tslib_1.__param(0, (0, repository_1.repository)(rule_repository_1.RuleRepository)),
    tslib_1.__param(1, (0, repository_1.repository)(rule_execution_log_repository_1.RuleExecutionLogRepository)),
    tslib_1.__param(2, (0, core_1.inject)('services.RuleEngineService')),
    tslib_1.__metadata("design:paramtypes", [rule_repository_1.RuleRepository,
        rule_execution_log_repository_1.RuleExecutionLogRepository,
        rule_engine_service_1.RuleEngineService])
], RuleController);
//# sourceMappingURL=rule.controller.js.map