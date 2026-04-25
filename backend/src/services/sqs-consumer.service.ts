import {injectable, inject, LifeCycleObserver, lifeCycleObserver} from '@loopback/core';
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  Message,
} from '@aws-sdk/client-sqs';
import {RuleEngineService} from './rule-engine.service';
import {SqsMessagePayload} from '../types/rule.types';

@lifeCycleObserver('server')
@injectable()
export class SqsConsumerService implements LifeCycleObserver {
  private client: SQSClient;
  private queueUrl: string;
  private polling = false;
  private pollInterval: NodeJS.Timeout | null = null;

  constructor(
    @inject('services.RuleEngineService')
    private ruleEngine: RuleEngineService,
  ) {
    const region = process.env['AWS_REGION'] ?? 'us-east-1';
    this.queueUrl = process.env['SQS_QUEUE_URL'] ?? '';
    this.client = new SQSClient({
      region,
      ...(process.env['AWS_ENDPOINT']
        ? {endpoint: process.env['AWS_ENDPOINT']}
        : {}),
    });
  }

  async start(): Promise<void> {
    if (!this.queueUrl) {
      console.warn('[SqsConsumer] SQS_QUEUE_URL not set — consumer disabled');
      return;
    }
    this.polling = true;
    console.log(`[SqsConsumer] Polling ${this.queueUrl}`);
    this.schedulePoll();
  }

  async stop(): Promise<void> {
    this.polling = false;
    if (this.pollInterval) {
      clearTimeout(this.pollInterval);
      this.pollInterval = null;
    }
  }

  private schedulePoll(): void {
    const intervalMs = parseInt(process.env['SQS_POLL_INTERVAL_MS'] ?? '5000', 10);
    this.pollInterval = setTimeout(async () => {
      if (!this.polling) return;
      try {
        await this.poll();
      } catch (err) {
        console.error('[SqsConsumer] Poll error:', err);
      }
      this.schedulePoll();
    }, intervalMs);
  }

  private async poll(): Promise<void> {
    const command = new ReceiveMessageCommand({
      QueueUrl: this.queueUrl,
      MaxNumberOfMessages: 10,
      WaitTimeSeconds: 10,
    });

    const response = await this.client.send(command);
    const messages = response.Messages ?? [];

    await Promise.all(messages.map(msg => this.processMessage(msg)));
  }

  private async processMessage(msg: Message): Promise<void> {
    if (!msg.Body) return;

    let payload: SqsMessagePayload;
    try {
      payload = JSON.parse(msg.Body) as SqsMessagePayload;
    } catch {
      console.error('[SqsConsumer] Failed to parse message body:', msg.Body);
      await this.deleteMessage(msg.ReceiptHandle!);
      return;
    }

    try {
      await this.ruleEngine.executeForEntity(
        payload.entityType,
        'SQS',
        payload.payload,
      );
    } catch (err) {
      console.error('[SqsConsumer] Rule execution error:', err);
    }

    await this.deleteMessage(msg.ReceiptHandle!);
  }

  private async deleteMessage(receiptHandle: string): Promise<void> {
    await this.client.send(
      new DeleteMessageCommand({
        QueueUrl: this.queueUrl,
        ReceiptHandle: receiptHandle,
      }),
    );
  }
}
