import {Entity, model, property} from '@loopback/repository';
import {
  TriggerType,
  RuleNodeSchema,
  NodeConnectionSchema,
} from '../types/rule.types';

@model({
  settings: {
    strict: true,
    mysql: {table: 'rule'},
  },
})
export class Rule extends Entity {
  @property({
    type: 'string',
    id: true,
    defaultFn: 'uuidv4',
    mysql: {columnName: 'id', dataType: 'char', dataLength: 36, nullable: 'N'},
  })
  id?: string;

  @property({
    type: 'string',
    required: true,
    mysql: {columnName: 'name', dataType: 'varchar', dataLength: 255, nullable: 'N'},
  })
  name!: string;

  @property({type: 'string', mysql: {columnName: 'description', dataType: 'text', nullable: 'Y'}})
  description?: string;

  @property({
    type: 'string',
    required: true,
    mysql: {columnName: 'entity_type', dataType: 'varchar', dataLength: 64, nullable: 'N'},
  })
  entityType!: string;

  @property({
    type: 'boolean',
    default: false,
    mysql: {columnName: 'is_active', dataType: 'tinyint', dataLength: 1, nullable: 'N'},
  })
  isActive!: boolean;

  @property({
    type: 'array',
    itemType: 'string',
    default: [],
    mysql: {columnName: 'trigger_types', dataType: 'json', nullable: 'N'},
  })
  triggerTypes!: TriggerType[];

  @property({
    type: 'array',
    itemType: 'object',
    default: [],
    mysql: {columnName: 'nodes', dataType: 'json', nullable: 'N'},
  })
  nodes!: RuleNodeSchema[];

  @property({
    type: 'array',
    itemType: 'object',
    default: [],
    mysql: {columnName: 'connections', dataType: 'json', nullable: 'N'},
  })
  connections!: NodeConnectionSchema[];

  @property({
    type: 'date',
    defaultFn: 'now',
    mysql: {columnName: 'created_at', dataType: 'datetime', precision: 3, nullable: 'N'},
  })
  createdAt?: Date;

  @property({
    type: 'date',
    defaultFn: 'now',
    mysql: {columnName: 'updated_at', dataType: 'datetime', precision: 3, nullable: 'N'},
  })
  updatedAt?: Date;

  // No defaults here: repositories build an instance from partial updates
  // (PATCH, toggle), so constructor defaults would overwrite stored values.
  // Create-time defaults come from the @property `default` settings.
  constructor(data?: Partial<Rule>) {
    super(data);
  }
}

export interface RuleRelations {}

export type RuleWithRelations = Rule & RuleRelations;
