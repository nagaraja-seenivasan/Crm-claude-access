import { DefaultCrudRepository } from '@loopback/repository';
import { DbDataSource } from '../datasources/db.datasource';
import { RuleExecutionLog, RuleExecutionLogRelations } from '../models/rule-execution-log.model';
export declare class RuleExecutionLogRepository extends DefaultCrudRepository<RuleExecutionLog, typeof RuleExecutionLog.prototype.id, RuleExecutionLogRelations> {
    constructor(dataSource: DbDataSource);
}
