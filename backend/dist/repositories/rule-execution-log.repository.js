"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuleExecutionLogRepository = void 0;
const tslib_1 = require("tslib");
const core_1 = require("@loopback/core");
const repository_1 = require("@loopback/repository");
const db_datasource_1 = require("../datasources/db.datasource");
const rule_execution_log_model_1 = require("../models/rule-execution-log.model");
let RuleExecutionLogRepository = class RuleExecutionLogRepository extends repository_1.DefaultCrudRepository {
    constructor(dataSource) {
        super(rule_execution_log_model_1.RuleExecutionLog, dataSource);
    }
};
exports.RuleExecutionLogRepository = RuleExecutionLogRepository;
exports.RuleExecutionLogRepository = RuleExecutionLogRepository = tslib_1.__decorate([
    tslib_1.__param(0, (0, core_1.inject)('datasources.db')),
    tslib_1.__metadata("design:paramtypes", [db_datasource_1.DbDataSource])
], RuleExecutionLogRepository);
//# sourceMappingURL=rule-execution-log.repository.js.map