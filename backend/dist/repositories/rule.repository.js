"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuleRepository = void 0;
const tslib_1 = require("tslib");
const core_1 = require("@loopback/core");
const repository_1 = require("@loopback/repository");
const db_datasource_1 = require("../datasources/db.datasource");
const rule_model_1 = require("../models/rule.model");
let RuleRepository = class RuleRepository extends repository_1.DefaultCrudRepository {
    constructor(dataSource) {
        super(rule_model_1.Rule, dataSource);
    }
};
exports.RuleRepository = RuleRepository;
exports.RuleRepository = RuleRepository = tslib_1.__decorate([
    tslib_1.__param(0, (0, core_1.inject)('datasources.db')),
    tslib_1.__metadata("design:paramtypes", [db_datasource_1.DbDataSource])
], RuleRepository);
//# sourceMappingURL=rule.repository.js.map