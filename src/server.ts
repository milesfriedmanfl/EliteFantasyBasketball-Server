import * as dotenv from 'dotenv';
dotenv.config();
import {Singleton} from "./utils/singleton.js";
import {LoggerDelegate} from "./utils/logger/logger-delegate.js";
import {NestFactory} from "@nestjs/core";
import {AppModule} from "./app/app.module.js";
import type {INestApplication} from "@nestjs/common";

export class Server extends Singleton {
    private static PORT = 3000;
    private readonly _logger: LoggerDelegate;
    private server: INestApplication;

    private constructor() {
        super();
        this._logger = new LoggerDelegate(Server.name);
    }

    public async start() {
        this.server = await NestFactory.create(AppModule);

        await this.server.listen(Server.PORT, () => {
           this._logger.info(`Server is running on port ${Server.PORT}...`)
        });
    }

    public stop() {
        this.server.close().then(() => {
            this._logger.info(`Server stopped.`);
        });
    }
}
