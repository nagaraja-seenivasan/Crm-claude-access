import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {DbDataSource} from '../datasources/db.datasource';
import {Rule, RuleRelations} from '../models/rule.model';

export class RuleRepository extends DefaultCrudRepository<
  Rule,
  typeof Rule.prototype.id,
  RuleRelations
> {
  constructor(@inject('datasources.db') dataSource: DbDataSource) {
    super(Rule, dataSource);
  }
}
