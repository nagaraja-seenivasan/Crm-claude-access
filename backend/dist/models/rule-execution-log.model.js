"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuleExecutionLog = void 0;
const tslib_1 = require("tslib");
const repository_1 = require("@loopback/repository");
let RuleExecutionLog = class RuleExecutionLog extends repository_1.Entity {
    constructor(data) {
        var _a, _b, _c, _d, _e, _f;
        super(data);
        this.ruleId = (_a = data === null || data === void 0 ? void 0 : data.ruleId) !== null && _a !== void 0 ? _a : '';
        this.ruleName = (_b = data === null || data === void 0 ? void 0 : data.ruleName) !== null && _b !== void 0 ? _b : '';
        this.entityType = (_c = data === null || data === void 0 ? void 0 : data.entityType) !== null && _c !== void 0 ? _c : '';
        this.triggerType = (_d = data === null || data === void 0 ? void 0 : data.triggerType) !== null && _d !== void 0 ? _d : 'RECORD_SAVE';
        this.outcome = (_e = data === null || data === void 0 ? void 0 : data.outcome) !== null && _e !== void 0 ? _e : 'completed';
        this.nodesExecuted = (_f = data === null || data === void 0 ? void 0 : data.nodesExecuted) !== null && _f !== void 0 ? _f : [];
    }
};
exports.RuleExecutionLog = RuleExecutionLog;
tslib_1.__decorate([
    (0, repository_1.property)({
        type: 'string',
        id: true,
        generated: true,
        mongodb: { dataType: 'ObjectID' },
    }),
    tslib_1.__metadata("design:type", String)
], RuleExecutionLog.prototype, "id", void 0);
tslib_1.__decorate([
    (0, repository_1.property)({ type: 'string', required: true }),
    tslib_1.__metadata("design:type", String)
], RuleExecutionLog.prototype, "ruleId", void 0);
tslib_1.__decorate([
    (0, repository_1.property)({ type: 'string', required: true }),
    tslib_1.__metadata("design:type", String)
], RuleExecutionLog.prototype, "ruleName", void 0);
tslib_1.__decorate([
    (0, repository_1.property)({ type: 'string', required: true }),
    tslib_1.__metadata("design:type", String)
], RuleExecutionLog.prototype, "entityType", void 0);
tslib_1.__decorate([
    (0, repository_1.property)({ type: 'string' }),
    tslib_1.__metadata("design:type", String)
], RuleExecutionLog.prototype, "entityId", void 0);
tslib_1.__decorate([
    (0, repository_1.property)({ type: 'string', required: true }),
    tslib_1.__metadata("design:type", String)
], RuleExecutionLog.prototype, "triggerType", void 0);
tslib_1.__decorate([
    (0, repository_1.property)({ type: 'string', required: true }),
    tslib_1.__metadata("design:type", String)
], RuleExecutionLog.prototype, "outcome", void 0);
tslib_1.__decorate([
    (0, repository_1.property)({
        type: 'array',
        itemType: 'string',
        default: [],
    }),
    tslib_1.__metadata("design:type", Array)
], RuleExecutionLog.prototype, "nodesExecuted", void 0);
tslib_1.__decorate([
    (0, repository_1.property)({ type: 'string' }),
    tslib_1.__metadata("design:type", String)
], RuleExecutionLog.prototype, "errorMessage", void 0);
tslib_1.__decorate([
    (0, repository_1.property)({ type: 'object' }),
    tslib_1.__metadata("design:type", Object)
], RuleExecutionLog.prototype, "scopeSnapshot", void 0);
tslib_1.__decorate([
    (0, repository_1.property)({ type: 'date', defaultFn: 'now' }),
    tslib_1.__metadata("design:type", Date)
], RuleExecutionLog.prototype, "executedAt", void 0);
exports.RuleExecutionLog = RuleExecutionLog = tslib_1.__decorate([
    (0, repository_1.model)({
        settings: {
            strict: false,
            mongodb: { collection: 'ruleExecutionLogs' },
        },
    }),
    tslib_1.__metadata("design:paramtypes", [Object])
], RuleExecutionLog);
//# sourceMappingURL=rule-execution-log.model.js.map