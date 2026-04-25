import {ApplicationConfig, CrmRuleBuilderApplication} from './application';

export * from './application';

export async function main(options: ApplicationConfig = {}): Promise<CrmRuleBuilderApplication> {
  const app = new CrmRuleBuilderApplication(options);
  await app.boot();
  await app.start();

  const url = app.restServer.url;
  console.log(`CRM Rule Builder API running at ${url}`);
  console.log(`Explorer: ${url}/explorer`);

  const sqsConsumer = await app.get<import('./services/sqs-consumer.service').SqsConsumerService>(
    'services.SqsConsumerService',
  );
  await sqsConsumer.start();

  return app;
}

main({
  rest: {
    port: parseInt(process.env['PORT'] ?? '3000', 10),
    host: process.env['HOST'] ?? '0.0.0.0',
    openApiSpec: {
      setServersFromRequest: true,
    },
  },
}).catch(err => {
  console.error('Failed to start application:', err);
  process.exit(1);
});
