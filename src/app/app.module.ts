import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import {DeferredResponseHandlerModule} from "../deferred-response-handler/deferred-response-handler.module.js";
import {DiscordCommandHandlerService} from "../discord-command-handler/discord-command-handler.service.js";

@Module({
    imports: [DeferredResponseHandlerModule],
    controllers: [AppController],
    providers: [DiscordCommandHandlerService],
})
export class AppModule {}