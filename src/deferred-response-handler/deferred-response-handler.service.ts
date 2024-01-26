import { Injectable } from '@nestjs/common';
import {LoggerDelegate} from "../utils/logger/logger-delegate.js";
import {Subject, takeUntil} from "rxjs";
import {LiveStandingsHandlerService} from "./command-handlers/live-standings-handler.service.js";
import type {DeferredCommand} from "./command-handlers/interfaces/command-handler.interfaces.js";
import type { RequiringCleanup } from "../utils/interfaces/global.interfaces.js";
import { RequiresCleanup } from '../utils/decorators/requiring-cleanup.decorator.js';
import {CategoryRecordHoldersHandlerService} from "./command-handlers/category-record-holders-handler.service.js";

export enum AsyncCommand {
    LIVE_STANDINGS = 'live-standings',
    CATEGORY_RECORD_HOLDERS = 'category-record-holders'
}

@Injectable()
@RequiresCleanup()
export class DeferredResponseHandlerService implements RequiringCleanup {
    private readonly _logger: LoggerDelegate;
    private readonly _handleDeferredResponse$ = new Subject<DeferredCommand>();
    private readonly _killService$ = new Subject<void>();

    constructor(private readonly liveStandingsHandler: LiveStandingsHandlerService, private readonly categoryRecordHoldersHandler: CategoryRecordHoldersHandlerService) {
        this._logger = new LoggerDelegate(DeferredResponseHandlerService.name);

        this.handleDeferredResponse$
            .pipe(
                takeUntil(this._killService$)
            )
            .subscribe(async ({commandName, interactionID}) => {
                this._logger.info(`Received Deferred Command: ${commandName}. Handling...`);
                switch(commandName) {
                    case AsyncCommand.LIVE_STANDINGS:
                        await liveStandingsHandler.handleAsyncCommand(interactionID);
                        break;
                    case AsyncCommand.CATEGORY_RECORD_HOLDERS:
                        await categoryRecordHoldersHandler.handleAsyncCommand(interactionID);
                        break;
                    default:
                        this._logger.error(`Cannot handle an async command that is not recognized or doesn't exist.`);
                }
            });
    }

    public cleanup() {
        this._killService$.next();
        this._killService$.complete();
    }

    public get handleDeferredResponse$() {
        return this._handleDeferredResponse$
    }
}
