import {injectable} from '@loopback/core';
import {NotificationNodeData, NotificationChannel} from '../types/rule.types';

export interface NotificationPayload {
  channel: NotificationChannel;
  recipient: string;
  subject?: string;
  body: string;
  templateId: string;
  scope: Record<string, unknown>;
}

@injectable()
export class NotificationService {
  async send(
    config: NotificationNodeData,
    scope: Record<string, unknown>,
  ): Promise<void> {
    const recipient = this.resolveRecipient(config.recipientField, scope);
    const recipients = [recipient, ...(config.additionalRecipients ?? [])].filter(
      Boolean,
    );

    for (const to of recipients) {
      const payload: NotificationPayload = {
        channel: config.channel,
        recipient: to,
        subject: config.subject,
        body: this.interpolate(config.templateId, scope),
        templateId: config.templateId,
        scope,
      };
      await this.dispatch(payload);
    }
  }

  private async dispatch(payload: NotificationPayload): Promise<void> {
    switch (payload.channel) {
      case 'EMAIL':
        await this.sendEmail(payload);
        break;
      case 'SMS':
        await this.sendSms(payload);
        break;
      case 'PUSH':
        await this.sendPush(payload);
        break;
      case 'WEBHOOK':
        await this.sendWebhook(payload);
        break;
    }
  }

  private async sendEmail(payload: NotificationPayload): Promise<void> {
    // Integrate with SES / SendGrid / SMTP here
    console.log(`[EMAIL] to=${payload.recipient} subject="${payload.subject}" template=${payload.templateId}`);
  }

  private async sendSms(payload: NotificationPayload): Promise<void> {
    // Integrate with SNS / Twilio here
    console.log(`[SMS] to=${payload.recipient} template=${payload.templateId}`);
  }

  private async sendPush(payload: NotificationPayload): Promise<void> {
    // Integrate with FCM / APNs here
    console.log(`[PUSH] to=${payload.recipient} template=${payload.templateId}`);
  }

  private async sendWebhook(payload: NotificationPayload): Promise<void> {
    // payload.recipient is the webhook URL when channel=WEBHOOK
    console.log(`[WEBHOOK] url=${payload.recipient} scope_id=${payload.scope['id']}`);
  }

  private resolveRecipient(
    recipientField: string,
    scope: Record<string, unknown>,
  ): string {
    const val = recipientField
      .split('.')
      .reduce((acc: unknown, key) => {
        if (acc !== null && typeof acc === 'object') {
          return (acc as Record<string, unknown>)[key];
        }
        return undefined;
      }, scope as unknown);
    return val != null ? String(val) : '';
  }

  private interpolate(template: string, scope: Record<string, unknown>): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
      const val = path
        .trim()
        .split('.')
        .reduce((acc: unknown, key) => {
          if (acc !== null && typeof acc === 'object') {
            return (acc as Record<string, unknown>)[key];
          }
          return undefined;
        }, scope as unknown);
      return val != null ? String(val) : '';
    });
  }
}
