import express from 'express';
import * as dotenv from 'dotenv';
dotenv.config();
import {Singleton} from "./utils/singleton.js";
import {LoggerDelegate} from "./utils/logger/logger-delegate.js";
import {DiscordCommandHandler} from "./discord-command-handler/discord-command-handler.js";
import {DeferredResponseHandler} from "./deferred-response-handler/deferred-response-handler.js";

export class Server extends Singleton {
    private static PORT = 3000;
    private readonly _logger: LoggerDelegate;
    private readonly _deferredResponseHandler: DeferredResponseHandler;
    private readonly _discordCommandHandler: DiscordCommandHandler;
    private readonly _express;
    private server;

    private constructor() {
        super();

        this._logger = new LoggerDelegate(Server.name);
        this._deferredResponseHandler = DeferredResponseHandler.Instance as DeferredResponseHandler;
        this._discordCommandHandler = DiscordCommandHandler.Instance as DiscordCommandHandler;
        this._express = express();

        this.configure();
    }

    private configure() {
        this._express.use(express.json());

        this._express.get('/health', async (req, res) => {
            this._logger.info(`Received health check request: ${JSON.stringify(req?.body)}`);
            res.status(200).send('OK');
        });

        this._express.post('/league-commands', async (req, res) => {
           try {
               const response = await this._discordCommandHandler.handleCommand(req.body);
               res.status(200).json(response);
           } catch (error) {
               this._logger.error(`Error handling request: ${JSON.stringify(req?.body)}`);
               res.status(500).send(error)
           }
        });

        this._express.use((req, res) => {
            res.status(404).json({ error: 'Command not found' });
        })
    }

    public start() {
        this.server = this._express.listen(Server.PORT, () => {
           this._logger.info(`Server is running on port ${Server.PORT}...`)
        });
    }

    public stop() {
        this._deferredResponseHandler.stopServer$.next();
        this._deferredResponseHandler.stopServer$.complete();

        this.server.close(() => {
            this._logger.info(`Server stopped.`);
        });
    }
}
