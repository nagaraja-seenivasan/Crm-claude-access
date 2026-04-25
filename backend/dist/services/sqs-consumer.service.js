"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SqsConsumerService = void 0;
const tslib_1 = require("tslib");
const core_1 = require("@loopback/core");
const client_sqs_1 = require("@aws-sdk/client-sqs");
const rule_engine_service_1 = require("./rule-engine.service");
let SqsConsumerService = class SqsConsumerService {
    constructor(ruleEngine) {
        var _a, _b;
        this.ruleEngine = ruleEngine;
        this.polling = false;
        this.pollInterval = null;
        const region = (_a = process.env['AWS_REGION']) !== null && _a !== void 0 ? _a : 'us-east-1';
        this.queueUrl = (_b = process.env['SQS_QUEUE_URL']) !== null && _b !== void 0 ? _b : '';
        this.client = new client_sqs_1.SQSClient({
            region,
            ...(process.env['AWS_ENDPOINT']
                ? { endpoint: process.env['AWS_ENDPOINT'] }
                : {}),
        });
    }
    async start() {
        if (!this.queueUrl) {
            console.warn('[SqsConsumer] SQS_QUEUE_URL not set — consumer disabled');
            return;
        }
        this.polling = true;
        console.log(`[SqsConsumer] Polling ${this.queueUrl}`);
        this.schedulePoll();
    }
    async stop() {
        this.polling = false;
        if (this.pollInterval) {
            clearTimeout(this.pollInterval);
            this.pollInterval = null;
        }
    }
    schedulePoll() {
        var _a;
        const intervalMs = parseInt((_a = process.env['SQS_POLL_INTERVAL_MS']) !== null && _a !== void 0 ? _a : '5000', 10);
        this.pollInterval = setTimeout(async () => {
            if (!this.polling)
                return;
            try {
                await this.poll();
            }
            catch (err) {
                console.error('[SqsConsumer] Poll error:', err);
            }
            this.schedulePoll();
        }, intervalMs);
    }
    async poll() {
        var _a;
        const command = new client_sqs_1.ReceiveMessageCommand({
            QueueUrl: this.queueUrl,
            MaxNumberOfMessages: 10,
            WaitTimeSeconds: 10,
        });
        const response = await this.client.send(command);
        const messages = (_a = response.Messages) !== null && _a !== void 0 ? _a : [];
        await Promise.all(messages.map(msg => this.processMessage(msg)));
    }
    async processMessage(msg) {
        if (!msg.Body)
            return;
        let payload;
        try {
            payload = JSON.parse(msg.Body);
        }
        catch (_a) {
            console.error('[SqsConsumer] Failed to parse message body:', msg.Body);
            await this.deleteMessage(msg.ReceiptHandle);
            return;
        }
        try {
            await this.ruleEngine.executeForEntity(payload.entityType, 'SQS', payload.payload);
        }
        catch (err) {
            console.error('[SqsConsumer] Rule execution error:', err);
        }
        await this.deleteMessage(msg.ReceiptHandle);
    }
    async deleteMessage(receiptHandle) {
        await this.client.send(new client_sqs_1.DeleteMessageCommand({
            QueueUrl: this.queueUrl,
            ReceiptHandle: receiptHandle,
        }));
    }
};
exports.SqsConsumerService = SqsConsumerService;
exports.SqsConsumerService = SqsConsumerService = tslib_1.__decorate([
    (0, core_1.lifeCycleObserver)('server'),
    (0, core_1.injectable)(),
    tslib_1.__param(0, (0, core_1.inject)('services.RuleEngineService')),
    tslib_1.__metadata("design:paramtypes", [rule_engine_service_1.RuleEngineService])
], SqsConsumerService);
//# sourceMappingURL=sqs-consumer.service.js.map