export interface CommandMetadata {
    name: string;
    description: string;
}

export interface Command {
    metadata: CommandMetadata;
    execute: (string, Subject?) => any;
}