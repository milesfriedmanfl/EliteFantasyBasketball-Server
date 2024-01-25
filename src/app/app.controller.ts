import {Body, Controller, Get, Post, Res} from '@nestjs/common';
import {LoggerDelegate} from "../utils/logger/logger-delegate.js";
import {DiscordCommandHandlerService} from "../discord-command-handler/discord-command-handler.service.js";

@Controller()
export class AppController {
    private readonly _logger;

    constructor(private readonly _discordCommandHandlerService: DiscordCommandHandlerService) {
        this._logger = new LoggerDelegate(AppController.name);
    }

    // Responds to health checks to determine server liveness
    @Get('/health')
    async healthCheck(@Body() body, @Res() res): Promise<void> {
        this._logger.info(`Received health check request: ${JSON.stringify(body)}`);
        res.status(200).send('OK');
    }

    // Handles the initial response to all slash commands from discord
    @Post('/league-commands')
    async handleLeagueCommands(@Body() body, @Res() res): Promise<void> {
        try {
            const response = await this._discordCommandHandlerService.handleCommand(body);
            res.status(200).json(response);
        } catch (error) {
            this._logger.error(`Error handling request: ${JSON.stringify(body)}`);
            res.status(500).send(error);
        }
    }

    // Default route handler for unmatched routes
    @Get('*')
    notFound(@Res() res): void {
        this._logger.error(`Command not found ${JSON.stringify(res)}`);
        res.status(404).json({ error: 'Command not found' });
    }
}