import {inject, lifeCycleObserver, LifeCycleObserver} from '@loopback/core';
import {juggler} from '@loopback/repository';

const useMongo = !!process.env['MONGODB_URL'];

const config = useMongo
  ? {
      name: 'db',
      connector: 'mongodb',
      url: process.env['MONGODB_URL'],
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  : {
      name: 'db',
      connector: 'memory',
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
