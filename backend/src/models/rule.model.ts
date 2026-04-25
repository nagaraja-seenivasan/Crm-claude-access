import {Entity, model, property} from '@loopback/repository';
import {
  TriggerType,
  RuleNodeSchema,
  NodeConnectionSchema,
} from '../types/rule.types';

@model({
  settings: {
    strict: false,
    mongodb: {collection: 'rules'},
  },
})
export class Rule extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: true,
    mongodb: {dataType: 'ObjectID'},
  })
  id?: string;

  @property({type: 'string', required: true})
  name: string;

  @property({type: 'string'})
  description?: string;

  @property({type: 'string', required: true})
  entityType: string;

  @property({type: 'boolean', default: false})
  isActive: boolean;

  @property({
    type: 'array',
    itemType: 'string',
    default: [],
  })
  triggerTypes: TriggerType[];

  @property({
    type: 'array',
    itemType: 'object',
    default: [],
  })
  nodes: RuleNodeSchema[];

  @property({
    type: 'array',
    itemType: 'object',
    default: [],
  })
  connections: NodeConnectionSchema[];

  @property({
    type: 'date',
    defaultFn: 'now',
  })
  createdAt?: Date;

  @property({
    type: 'date',
    defaultFn: 'now',
  })
  updatedAt?: Date;

  constructor(data?: Partial<Rule>) {
    super(data);
    this.name = data?.name ?? '';
    this.entityType = data?.entityType ?? '';
    this.isActive = data?.isActive ?? false;
    this.triggerTypes = data?.triggerTypes ?? [];
    this.nodes = data?.nodes ?? [];
    this.connections = data?.connections ?? [];
  }
}

export interface RuleRelations {}

export type RuleWithRelations = Rule & RuleRelations;
