import {BootMixin} from '@loopback/boot';
import {ApplicationConfig} from '@loopback/core';
import {RepositoryMixin} from '@loopback/repository';
import {RestApplication} from '@loopback/rest';
import {RestExplorerBindings, RestExplorerComponent} from '@loopback/rest-explorer';
import {ServiceMixin} from '@loopback/service-proxy';
import {RuleController} from './controllers/rule.controller';
import {DbDataSource} from './datasources/db.datasource';
import {RuleRepository} from './repositories/rule.repository';
import {RuleExecutionLogRepository} from './repositories/rule-execution-log.repository';
import {RuleEngineService} from './services/rule-engine.service';
import {NotificationService} from './services/notification.service';
import {SqsConsumerService} from './services/sqs-consumer.service';

export {ApplicationConfig};

export class CrmRuleBuilderApplication extends BootMixin(
  ServiceMixin(RepositoryMixin(RestApplication)),
) {
  constructor(options: ApplicationConfig = {}) {
    super(options);

    this.configure(RestExplorerBindings.COMPONENT).to({path: '/explorer'});
    this.component(RestExplorerComponent);

    this.projectRoot = __dirname;
    this.bootOptions = {
      controllers: {dirs: ['controllers'], extensions: ['.controller.js'], nested: true},
    };

    this.bind('datasources.db').toClass(DbDataSource);
    this.bind('repositories.RuleRepository').toClass(RuleRepository);
    this.bind('repositories.RuleExecutionLogRepository').toClass(RuleExecutionLogRepository);
    this.bind('services.NotificationService').toClass(NotificationService);
    this.bind('services.RuleEngineService').toClass(RuleEngineService);
    this.bind('services.SqsConsumerService').toClass(SqsConsumerService);

    this.controller(RuleController);

    this.setupCors();
  }

  private setupCors(): void {
    this.bind('rest.cors').to({
      origin: process.env['CORS_ORIGIN'] ?? 'http://localhost:4200',
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
      allowedHeaders: 'Content-Type,Authorization',
      credentials: true,
    });
  }
}
