export interface CommandMetadata {
    name: string;
    description: string;
}

export interface CommandInterfaces {
    metadata: CommandMetadata;
    execute: (string, Subject?) => any;
}