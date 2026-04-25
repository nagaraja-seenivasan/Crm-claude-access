"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const tslib_1 = require("tslib");
const core_1 = require("@loopback/core");
let NotificationService = class NotificationService {
    async send(config, scope) {
        var _a;
        const recipient = this.resolveRecipient(config.recipientField, scope);
        const recipients = [recipient, ...((_a = config.additionalRecipients) !== null && _a !== void 0 ? _a : [])].filter(Boolean);
        for (const to of recipients) {
            const payload = {
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
    async dispatch(payload) {
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
    async sendEmail(payload) {
        // Integrate with SES / SendGrid / SMTP here
        console.log(`[EMAIL] to=${payload.recipient} subject="${payload.subject}" template=${payload.templateId}`);
    }
    async sendSms(payload) {
        // Integrate with SNS / Twilio here
        console.log(`[SMS] to=${payload.recipient} template=${payload.templateId}`);
    }
    async sendPush(payload) {
        // Integrate with FCM / APNs here
        console.log(`[PUSH] to=${payload.recipient} template=${payload.templateId}`);
    }
    async sendWebhook(payload) {
        // payload.recipient is the webhook URL when channel=WEBHOOK
        console.log(`[WEBHOOK] url=${payload.recipient} scope_id=${payload.scope['id']}`);
    }
    resolveRecipient(recipientField, scope) {
        const val = recipientField
            .split('.')
            .reduce((acc, key) => {
            if (acc !== null && typeof acc === 'object') {
                return acc[key];
            }
            return undefined;
        }, scope);
        return val != null ? String(val) : '';
    }
    interpolate(template, scope) {
        return template.replace(/\{\{([^}]+)\}\}/g, (_, path) => {
            const val = path
                .trim()
                .split('.')
                .reduce((acc, key) => {
                if (acc !== null && typeof acc === 'object') {
                    return acc[key];
                }
                return undefined;
            }, scope);
            return val != null ? String(val) : '';
        });
    }
};
exports.NotificationService = NotificationService;
exports.NotificationService = NotificationService = tslib_1.__decorate([
    (0, core_1.injectable)()
], NotificationService);
//# sourceMappingURL=notification.service.js.map