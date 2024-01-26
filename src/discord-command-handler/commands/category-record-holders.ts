import { InteractionResponseType } from 'discord-interactions';
import {AsyncCommand} from "../../deferred-response-handler/deferred-response-handler.service.js";
import type {Subject} from "rxjs";
import type {
    DeferredCommand
} from "../../deferred-response-handler/command-handlers/interfaces/command-handler.interfaces.js";

export default abstract class CategoryRecordHolders {
    public static metadata = {
        name: AsyncCommand.CATEGORY_RECORD_HOLDERS,
        description: 'gets the record holders for highest total for each counting stat in a week'
    };

    public static execute(interactionID: string, handleDeferredResponse$: Subject<DeferredCommand>) {
        // Send a message to the DeferredResponseHandler to handle the async operations for this command
        handleDeferredResponse$.next({commandName: AsyncCommand.CATEGORY_RECORD_HOLDERS, interactionID: interactionID})

        // Send initial response (loading state) which will be updated with a deferred response after building the live standings output
        return {
            type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
        }
    }
}