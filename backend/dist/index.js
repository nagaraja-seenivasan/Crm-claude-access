"use strict";
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = void 0;
const tslib_1 = require("tslib");
const application_1 = require("./application");
tslib_1.__exportStar(require("./application"), exports);
async function main(options = {}) {
    const app = new application_1.CrmRuleBuilderApplication(options);
    await app.boot();
    await app.start();
    const url = app.restServer.url;
    console.log(`CRM Rule Builder API running at ${url}`);
    console.log(`Explorer: ${url}/explorer`);
    const sqsConsumer = await app.get('services.SqsConsumerService');
    await sqsConsumer.start();
    return app;
}
exports.main = main;
main({
    rest: {
        port: parseInt((_a = process.env['PORT']) !== null && _a !== void 0 ? _a : '3000', 10),
        host: (_b = process.env['HOST']) !== null && _b !== void 0 ? _b : '0.0.0.0',
        openApiSpec: {
            setServersFromRequest: true,
        },
    },
}).catch(err => {
    console.error('Failed to start application:', err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map