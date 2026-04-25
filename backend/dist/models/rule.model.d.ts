import { Entity } from '@loopback/repository';
import { TriggerType, RuleNodeSchema, NodeConnectionSchema } from '../types/rule.types';
export declare class Rule extends Entity {
    id?: string;
    name: string;
    description?: string;
    entityType: string;
    isActive: boolean;
    triggerTypes: TriggerType[];
    nodes: RuleNodeSchema[];
    connections: NodeConnectionSchema[];
    createdAt?: Date;
    updatedAt?: Date;
    constructor(data?: Partial<Rule>);
}
export interface RuleRelations {
}
export type RuleWithRelations = Rule & RuleRelations;
