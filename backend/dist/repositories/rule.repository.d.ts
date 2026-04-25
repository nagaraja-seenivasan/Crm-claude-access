import { DefaultCrudRepository } from '@loopback/repository';
import { DbDataSource } from '../datasources/db.datasource';
import { Rule, RuleRelations } from '../models/rule.model';
export declare class RuleRepository extends DefaultCrudRepository<Rule, typeof Rule.prototype.id, RuleRelations> {
    constructor(dataSource: DbDataSource);
}
