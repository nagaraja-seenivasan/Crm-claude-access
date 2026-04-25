import {inject, lifeCycleObserver, LifeCycleObserver} from '@loopback/core';
import {juggler} from '@loopback/repository';

const config = {
  name: 'db',
  connector: 'mongodb',
  url: process.env['MONGODB_URL'] ?? 'mongodb://localhost:27017/crm_rules',
  host: process.env['MONGODB_HOST'] ?? 'localhost',
  port: parseInt(process.env['MONGODB_PORT'] ?? '27017', 10),
  user: process.env['MONGODB_USER'] ?? '',
  password: process.env['MONGODB_PASSWORD'] ?? '',
  database: process.env['MONGODB_DB'] ?? 'crm_rules',
  useNewUrlParser: true,
  useUnifiedTopology: true,
};

@lifeCycleObserver('datasource')
export class DbDataSource
  extends juggler.DataSource
  implements LifeCycleObserver
{
  static readonly dataSourceName = 'db';
  static readonly defaultConfig = config;

  constructor(
    @inject('datasources.config.db', {optional: true})
    dsConfig: object = config,
  ) {
    super(dsConfig);
  }
}
