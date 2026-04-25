import { NotificationNodeData, NotificationChannel } from '../types/rule.types';
export interface NotificationPayload {
    channel: NotificationChannel;
    recipient: string;
    subject?: string;
    body: string;
    templateId: string;
    scope: Record<string, unknown>;
}
export declare class NotificationService {
    send(config: NotificationNodeData, scope: Record<string, unknown>): Promise<void>;
    private dispatch;
    private sendEmail;
    private sendSms;
    private sendPush;
    private sendWebhook;
    private resolveRecipient;
    private interpolate;
}
