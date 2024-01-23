import { InteractionType, InteractionResponseType, verifyKey } from 'discord-interactions';
import * as path from 'path';
import * as fs from 'fs';
import {Singleton} from "../utils/singleton.js";
import {LoggerDelegate} from "../utils/logger/logger-delegate.js";
import type {Subject} from "rxjs";
import {DeferredResponseHandler} from "../deferred-response-handler/deferred-response-handler.js";
import {fileURLToPath} from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Used to parse command files and route requests to the correct command execute function
 */
export class DiscordCommandHandler extends Singleton {
    private readonly _logger: LoggerDelegate;
    private readonly _handleDeferredResponse$: Subject<any>;

    private constructor() {
        super();

        this._logger = new LoggerDelegate(DiscordCommandHandler.name);
        this._handleDeferredResponse$ = (DeferredResponseHandler.Instance as DeferredResponseHandler).handleDeferredResponse$;
    }

    /**
     * Returns an object containing all commands specified by commands/*.ts files
     * */
    private async getCommandDefinitions() {
        this._logger.info(`Getting command definitions...`);

        const commandDefinitions = new Map();
        const commandsPath = path.join(__dirname, 'commands');

        this._logger.debug(`Variable commandsPath = ${commandsPath}`);

        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            const command = await import(filePath);

            this._logger.debug(`Current filePath = ${filePath}`);
            this._logger.debug(`command.default = ${command.default}`);

            // Confirm validity of command file and
            // if (command.hasOwnProperty('metadata') && command.hasOwnProperty('metadata')) {
            if ('metadata' in command.default && 'execute' in command.default) {
                this._logger.debug(`Found command with valid definition ${command?.default?.metadata?.name}. Adding to commandDefinitions...`);
                commandDefinitions.set(command.default.metadata.name, command.default);
            } else {
                this._logger.warn(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
            }
        }

        this._logger.info(`Retrieved command definitions: ${Array.from(commandDefinitions.keys()).join(', ')}`)
        return commandDefinitions;
    }

    /**
     * Handles command requests by parsing a message body and routing to their correct command file
     * @param event
     */
    public async handleCommand(event) {
        this._logger.debug(`Request Payload: ${JSON.stringify(event)}\n`);
        const params = JSON.parse(JSON.stringify(event['params']));
        this._logger.debug(`Parsed Params: ${JSON.stringify(params)}\n`);
        const payload = JSON.parse(JSON.stringify(event['body-json']));
        this._logger.debug(`Parsed Payload: ${JSON.stringify(payload)}\n`);

        switch(payload?.type) {
            case InteractionType.PING: /* Authenticate Endpoint */

                const signature = params?.header['x-signature-ed25519'];
                const timestamp = params?.header['x-signature-timestamp'];
                this._logger.info(`Attempting to verify with discord api...`);
                const isValidRequest = verifyKey(event['rawBody'], signature, timestamp, process.env.PUBLIC_KEY);
                if (!isValidRequest) {
                    throw new Error(`[UNAUTHORIZED] Invalid request signature given params: ${payload?.params}`);
                }
                this._logger.info(`Successfully verified!`);
                return { type: InteractionResponseType.PONG }

            case InteractionType.APPLICATION_COMMAND: /* Handle Application Commands */
                this._logger.info(`Received application command. Attempting to handle...`);
                const commandToRun = payload?.data?.name;
                this._logger.debug(`commandToRun = ${commandToRun}`)
                const commandDefinitions = await this.getCommandDefinitions();
                this._logger.debug(`commandDefinitions: ${JSON.stringify(commandDefinitions)}`);
                const interactionID = payload?.token;

                if (commandDefinitions.has(commandToRun)) {
                    this._logger.debug(`executing ${commandToRun}...`);
                    return commandDefinitions.get(commandToRun).execute(interactionID, this._handleDeferredResponse$);
                }
                throw new Error(`[ERROR] Invalid command. Command not found in registry: ${JSON.stringify(payload?.params)}`);

            default: /* Handle Unauthorized Request Types */
                throw new Error(`[ERROR] Invalid interaction type: ${JSON.stringify(payload?.type)}`);
        }
    }
}
