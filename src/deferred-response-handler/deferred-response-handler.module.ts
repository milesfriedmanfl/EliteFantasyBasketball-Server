import { Module } from '@nestjs/common';
import { DeferredResponseHandlerService } from './deferred-response-handler.service.js';
import { LiveStandingsHandlerService } from './command-handlers/live-standings-handler.service.js';
import {YahooFantasySportsApiService} from "./external-api/yahoo-fantasy-sports-api.service.js";
import {YahooOauthService} from "./dynamodb/yahoo-oauth.service.js";

@Module({
    providers: [
        DeferredResponseHandlerService,
        LiveStandingsHandlerService,
        YahooOauthService,
        YahooFantasySportsApiService],
    exports: [DeferredResponseHandlerService],
})
export class DeferredResponseHandlerModule {}