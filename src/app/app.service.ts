import {Inject, Injectable, type OnModuleDestroy} from '@nestjs/common';
import {CLASS_REQUIRING_CLEANUP} from "../utils/decorators/requiring-cleanup.decorator.js";
import type {RequiringCleanup} from "../utils/interfaces/global.interfaces.js";
import {LoggerDelegate} from "../utils/logger/logger-delegate.js";

@Injectable()
export class AppService implements OnModuleDestroy {
    private readonly _logger: LoggerDelegate;

    constructor(
        @Inject(CLASS_REQUIRING_CLEANUP)
        private readonly _classesRequiringCleanup: RequiringCleanup[],
    ) {
        this._logger = new LoggerDelegate(AppService.name);
    }

    onModuleDestroy() {
        this._classesRequiringCleanup.forEach(classRequiringCleanup => {
            classRequiringCleanup.cleanup();
        });
    }
}