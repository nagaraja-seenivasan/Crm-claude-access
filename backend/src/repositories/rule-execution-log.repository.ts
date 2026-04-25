import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {DbDataSource} from '../datasources/db.datasource';
import {
  RuleExecutionLog,
  RuleExecutionLogRelations,
} from '../models/rule-execution-log.model';

export class RuleExecutionLogRepository extends DefaultCrudRepository<
  RuleExecutionLog,
  typeof RuleExecutionLog.prototype.id,
  RuleExecutionLogRelations
> {
  constructor(@inject('datasources.db') dataSource: DbDataSource) {
    super(RuleExecutionLog, dataSource);
  }
}
