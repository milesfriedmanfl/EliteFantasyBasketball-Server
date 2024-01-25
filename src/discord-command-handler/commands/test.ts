import { InteractionResponseType } from 'discord-interactions';
import type {CommandInterfaces} from "../interfaces/command.interfaces.js";

export class Test implements CommandInterfaces  {
    public metadata: {
        name: 'test',
        description: 'a test command',
    };

    public execute() {
        return {
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
                content: 'Congrats, it worked you dingus. Now make something real...'
            }
        }
    }
}