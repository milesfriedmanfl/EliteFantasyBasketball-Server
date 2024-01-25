export interface AsyncCommandHandler {
    handleAsyncCommand: (interactionID: string) => any;
}

export interface DeferredCommand {
    commandName: string;
    interactionID: string;
}