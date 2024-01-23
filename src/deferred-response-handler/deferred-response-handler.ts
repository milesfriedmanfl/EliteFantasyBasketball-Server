import {LoggerDelegate} from "../utils/logger/logger-delegate.js";
import {Subject, takeUntil} from "rxjs";
import {Singleton} from "../utils/singleton.js";
import {LiveStandingsHandler} from "./command-handlers/live-standings-handler.js";
import type {DeferredCommand} from "./command-handlers/interfaces/command-handler-interfaces.js";

export enum AsyncCommand {
    LIVE_STANDINGS = 'live-standings'
}

export class DeferredResponseHandler extends Singleton {
    private readonly _logger: LoggerDelegate;
    private readonly _handleDeferredResponse$ = new Subject<DeferredCommand>();
    private readonly _stopServer$ = new Subject<void>();

    private constructor() {
        super();
        this._logger = new LoggerDelegate(DeferredResponseHandler.name);

        this.handleDeferredResponse$
            .pipe(
                takeUntil(this._stopServer$)
            )
            .subscribe(async ({commandName, interactionID}) => {
                this._logger.info(`Received Deferred Command: ${commandName}. Handling...`);
                switch(commandName) {
                    case AsyncCommand.LIVE_STANDINGS:
                        const liveStandingsHandler = new LiveStandingsHandler();
                        await liveStandingsHandler.handleAsyncCommand(interactionID);
                        break;
                    default:
                        this._logger.error(`Cannot handle an async command that is not recognized or doesn't exist.`);
                }
            });
    }

    public get handleDeferredResponse$() {
        return this._handleDeferredResponse$
    }

    public get stopServer$() {
        return this._stopServer$;
    }
}
