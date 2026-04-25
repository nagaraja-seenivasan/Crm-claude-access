"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrmRuleBuilderApplication = void 0;
const boot_1 = require("@loopback/boot");
const repository_1 = require("@loopback/repository");
const rest_1 = require("@loopback/rest");
const rest_explorer_1 = require("@loopback/rest-explorer");
const service_proxy_1 = require("@loopback/service-proxy");
const rule_controller_1 = require("./controllers/rule.controller");
const db_datasource_1 = require("./datasources/db.datasource");
const rule_repository_1 = require("./repositories/rule.repository");
const rule_execution_log_repository_1 = require("./repositories/rule-execution-log.repository");
const rule_engine_service_1 = require("./services/rule-engine.service");
const notification_service_1 = require("./services/notification.service");
const sqs_consumer_service_1 = require("./services/sqs-consumer.service");
class CrmRuleBuilderApplication extends (0, boot_1.BootMixin)((0, service_proxy_1.ServiceMixin)((0, repository_1.RepositoryMixin)(rest_1.RestApplication))) {
    constructor(options = {}) {
        super(options);
        this.configure(rest_explorer_1.RestExplorerBindings.COMPONENT).to({ path: '/explorer' });
        this.component(rest_explorer_1.RestExplorerComponent);
        this.projectRoot = __dirname;
        this.bootOptions = {
            controllers: { dirs: ['controllers'], extensions: ['.controller.js'], nested: true },
        };
        this.bind('datasources.db').toClass(db_datasource_1.DbDataSource);
        this.bind('repositories.RuleRepository').toClass(rule_repository_1.RuleRepository);
        this.bind('repositories.RuleExecutionLogRepository').toClass(rule_execution_log_repository_1.RuleExecutionLogRepository);
        this.bind('services.NotificationService').toClass(notification_service_1.NotificationService);
        this.bind('services.RuleEngineService').toClass(rule_engine_service_1.RuleEngineService);
        this.bind('services.SqsConsumerService').toClass(sqs_consumer_service_1.SqsConsumerService);
        this.controller(rule_controller_1.RuleController);
        this.setupCors();
    }
    setupCors() {
        var _a;
        this.bind('rest.cors').to({
            origin: (_a = process.env['CORS_ORIGIN']) !== null && _a !== void 0 ? _a : 'http://localhost:4200',
            methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
            allowedHeaders: 'Content-Type,Authorization',
            credentials: true,
        });
    }
}
exports.CrmRuleBuilderApplication = CrmRuleBuilderApplication;
//# sourceMappingURL=application.js.map