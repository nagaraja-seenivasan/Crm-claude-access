import { LifeCycleObserver } from '@loopback/core';
import { RuleEngineService } from './rule-engine.service';
export declare class SqsConsumerService implements LifeCycleObserver {
    private ruleEngine;
    private client;
    private queueUrl;
    private polling;
    private pollInterval;
    constructor(ruleEngine: RuleEngineService);
    start(): Promise<void>;
    stop(): Promise<void>;
    private schedulePoll;
    private poll;
    private processMessage;
    private deleteMessage;
}
