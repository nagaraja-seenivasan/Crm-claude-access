import {inject, lifeCycleObserver, LifeCycleObserver} from '@loopback/core';
import {juggler} from '@loopback/repository';

/**
 * MySQL 8.0+ datasource. Schema scripts: `database/mysql/` at the repo root.
 *
 * Connection settings (environment variables):
 *   MYSQL_URL                      mysql://user:pass@host:3306/database
 *   or MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE
 *   MYSQL_CONNECTION_LIMIT         pool size (default 10)
 *
 * With none of these set, an in-memory store is used (local development only;
 * data is lost on restart).
 */
const env = process.env;
const useMysql = !!(env['MYSQL_URL'] || env['MYSQL_HOST']);

const mysqlConfig = {
  name: 'db',
  connector: 'mysql',
  ...(env['MYSQL_URL']
    ? {url: env['MYSQL_URL']}
    : {
        host: env['MYSQL_HOST'],
        port: parseInt(env['MYSQL_PORT'] ?? '3306', 10),
        user: env['MYSQL_USER'],
        password: env['MYSQL_PASSWORD'],
        database: env['MYSQL_DATABASE'] ?? 'crm',
      }),
  connectionLimit: parseInt(env['MYSQL_CONNECTION_LIMIT'] ?? '10', 10),
  collation: 'utf8mb4_0900_ai_ci',
  // Store and read DATETIME values as UTC.
  timezone: 'Z',
};

const config = useMysql ? mysqlConfig : {name: 'db', connector: 'memory'};

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
    if (!useMysql) {
      console.warn('[db] MYSQL_URL / MYSQL_HOST not set — using in-memory store (development only)');
    }
  }
}
