import { LifeCycleObserver } from '@loopback/core';
import { juggler } from '@loopback/repository';
export declare class DbDataSource extends juggler.DataSource implements LifeCycleObserver {
    static readonly dataSourceName = "db";
    static readonly defaultConfig: {
        name: string;
        connector: string;
        url: string | undefined;
        useNewUrlParser: boolean;
        useUnifiedTopology: boolean;
    } | {
        name: string;
        connector: string;
        url?: undefined;
        useNewUrlParser?: undefined;
        useUnifiedTopology?: undefined;
    };
    constructor(dsConfig?: object);
}
