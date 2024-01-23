import { InteractionResponseType } from 'discord-interactions';
import type {Command} from "../interfaces/command.js";

export class Test implements Command  {
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