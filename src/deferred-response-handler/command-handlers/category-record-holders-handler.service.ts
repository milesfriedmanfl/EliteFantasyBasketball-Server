import fetch from "node-fetch";
import crypto from "crypto";
import {Injectable} from "@nestjs/common";
import {
    YAHOO_FANTASY_BASKETBALL_CATEGORY_IDS,
    YahooFantasySportsDataCrawler
} from "./utils/yahoo-fantasy-sports-data-crawler.js";
import {YahooFantasySportsApiService} from "../external-api/yahoo-fantasy-sports-api.service.js";
import {YahooOauthService} from "../dynamodb/yahoo-oauth.service.js";
import {catchError, from, switchMap, take} from "rxjs";
import {WebComponentToImageBuilder} from "../web-component-to-image-builder/web-component-to-image-builder.js";
import type {AsyncCommandHandler} from "./interfaces/command-handler.interfaces.js";
import type {HighestStatInWeekRecord} from "./interfaces/highest-stat-in-week.interfaces.js";

/**
 * Handles traversing yahoo fantasy sports data and building the live standings response to update a discord slash command output
 */
@Injectable()
export class CategoryRecordHoldersHandlerService extends YahooFantasySportsDataCrawler implements AsyncCommandHandler {
    public constructor(
        protected readonly _yahooFantasySportsApi: YahooFantasySportsApiService,
        protected readonly _yahooOauthService: YahooOauthService
    ) {
        super(CategoryRecordHoldersHandlerService.name, _yahooOauthService, _yahooFantasySportsApi);
    }

    /**
     * Creates the deferred response for the live standings command by:
     *
     * (1) Retrieving yahoo credentials
     * (2) Calculating live standings using yahoo fantasy sports api data
     * (3) Formatting the data and converting to an image using the HtmlToImageBuilder
     * (4) Creating an api call to discord using the interactionID of the initial command request
     *
     * @param interactionID - the identifier of the original slash command made by a user in a discord server
     */
    public async handleAsyncCommand(interactionID: string) {
        this._logger.debug(`Entered handleAsyncCommand(): interactionID = ${interactionID}`);

        this._logger.info(`Getting yahoo access token...`);
        const accessToken = await this.getYahooAccessToken();
        this._logger.info(`Calculating current highest stat in a week record holders...`);
        const liveStandings = await this.calculateWeeklyTotalRecordHolders(accessToken);
        this._logger.info(`Creating image from web component...`);

        try {
            const categoryRecordHolderProps = { highestStatInWeekRecordsAsJSON: JSON.stringify(liveStandings) };
            this._logger.debug(`stringifiedProps = ${JSON.stringify(categoryRecordHolderProps)}`);
            const liveStandingsImageBuilder = await new WebComponentToImageBuilder(
                'CategoryRecordHolders.svelte',
                categoryRecordHolderProps
            );
            const imageToAttach = await liveStandingsImageBuilder.buildImage('category-record-holders.jpeg');
            await this.createDeferredResponse(accessToken, interactionID, imageToAttach);
        } catch (e) {
            this._logger.error(e);
        }
    }

    /**
     * Builds multi-part form data to send a deferred response to discord with an embedded image
     * @param accessToken
     * @param interactionID
     * @param imageToAttach
     * @private
     */
    private async createDeferredResponse(accessToken: string, interactionID: string, imageToAttach: any) {
        const boundary = crypto.randomBytes(16).toString("hex");
        const data = "--" + boundary + "\n" +
            "Content-Disposition: form-data; name=\"payload_json\"; \n" +
            "Content-Type: application/json \n\n" +
            JSON.stringify(
                {
                    embeds: [{
                        title: "Category Record Holders",
                        description: "The highest total recorded in a week for each counting stat and which team holds the record. In the 2023/2024 season each record will pay out a bounty of $50 to the record holder once playoffs start",
                        image: {
                            url: "attachment://category-record-holders.jpeg"
                        },
                        type: "rich"
                    }],
                    attachments: [{
                        id: 0,
                        description: "Image of the records for highest stat total in a week",
                        filename: "category-record-holders.jpeg"
                    }]
                }
            ) + "\n\n" +
            "--" + boundary + "\n" +
            "Content-Disposition: form-data; name=\"files[0]\"; filename=\"category-record-holders.jpeg\" \n" +
            "Content-Type: image/jpeg \n" +
            "Content-Transfer-Encoding: base64 \n\n" +
            imageToAttach.toString('base64') + "\n" +
            "--" + boundary + "--\n";

        try {
            const response = await fetch(`https://www.discord.com/api/v10/webhooks/${process.env.APP_ID}/${interactionID}/messages/@original`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bot ${process.env.DISCORD_BOT_TOKEN}`,
                    'Content-Type': `multipart/form-data; boundary=${boundary}`
                },
                body: data
            });

            if (!response) {
                this._logger.error('Deferred interaction response failed!');
            } else {
                this._logger.info(`Deferred interaction response succeeded!`);
                this._logger.debug(`redirected = ${response.redirected}`);
                this._logger.debug(`status = ${response.status}`);
                this._logger.debug(`statusText = ${response.statusText}`);
                this._logger.debug(`type = ${response.type}`);
                this._logger.debug(`url = ${response.url}`);
                this._logger.debug(`response json = ${JSON.stringify(await response.json())}`);
                this._logger.debug(`response stringified = ${JSON.stringify(response)}`);
            }
        } catch (e) {
            this._logger.error(`Deferred interaction response failed with error: ${e}`);
        }
    }

    /**
     * Calculates the current record for total count in a week for each category and returns an object that contains: (stat, record, record_holder)
     */
    private async calculateWeeklyTotalRecordHolders(access_token: string) {
        this._logger.debug(`Entered calculateWeeklyTotalRecordHolders(): access_token = ${access_token}`);

        return new Promise(resolve => {
            let currentWeek;
            let startWeek;

            // Make an initial request for scoreboard data to be able to see the current week
            from(this._yahooFantasySportsApi.getLeagueScoreboard(access_token))
                .pipe(
                    take(1),
                    // Then make a subsequent request for scoreboard data for all prior weeks
                    switchMap(scoreboard => {
                        // Check the current week and start week by traversing the scorboard object
                        currentWeek = this.traversePath('scoreboard', scoreboard, ['fantasy_content', 'league', 'current_week', '_text']);
                        startWeek = this.traversePath('scoreboard', scoreboard, ['fantasy_content', 'league', 'start_week', '_text']);

                        // Make request for scoreboard data for all prior weeks than the current
                        return from(this._yahooFantasySportsApi.getLeagueScoreboardByWeek(access_token, this.allPriorWeeksQueryParam(Number(currentWeek), Number(startWeek))));
                    }),
                    catchError(_ => {
                        this._logger.error(`Api call to getLeagueScoreboard failed`);
                        return 'ERROR';
                    })
                )
                // Calculate weekly total record holders and return the structured object
                .subscribe(scoreboardForAllPriorWeeks => {
                    // Handle error if present
                    if (scoreboardForAllPriorWeeks === 'ERROR') {
                        resolve(null);
                    }

                    // Define categories to find weekly records for
                    const categoryRecordsMetadata: { [key: number]: HighestStatInWeekRecord } = {  // ignore efficiency cats
                        [YAHOO_FANTASY_BASKETBALL_CATEGORY_IDS.YAHOO_STAT_ID_THREES]: {
                            category: 'Threes',
                            recordTotal: 0,
                            recordHolderName: null,
                            recordHolderImage: null,
                            weekRecorded: null
                        },
                        [YAHOO_FANTASY_BASKETBALL_CATEGORY_IDS.YAHOO_STAT_ID_POINTS]: {
                            category: 'Points',
                            recordTotal: 0,
                            recordHolderName: null,
                            recordHolderImage: null,
                            weekRecorded: null
                        },
                        [YAHOO_FANTASY_BASKETBALL_CATEGORY_IDS.YAHOO_STAT_ID_REBOUNDS]: {
                            category: 'Rebounds',
                            recordTotal: 0,
                            recordHolderName: null,
                            recordHolderImage: null,
                            weekRecorded: null
                        },
                        [YAHOO_FANTASY_BASKETBALL_CATEGORY_IDS.YAHOO_STAT_ID_ASSISTS]: {
                            category: 'Assists',
                            recordTotal: 0,
                            recordHolderName: null,
                            recordHolderImage: null,
                            weekRecorded: null
                        },
                        [YAHOO_FANTASY_BASKETBALL_CATEGORY_IDS.YAHOO_STAT_ID_STEALS]: {
                            category: 'Steals',
                            recordTotal: 0,
                            recordHolderName: null,
                            recordHolderImage: null,
                            weekRecorded: null
                        },
                        [YAHOO_FANTASY_BASKETBALL_CATEGORY_IDS.YAHOO_STAT_ID_BLOCKS]: {
                            category: 'Blocks',
                            recordTotal: 0,
                            recordHolderName: null,
                            recordHolderImage: null,
                            weekRecorded: null
                        }
                    }
                    const matchups =
                        this.traversePath('scoreboardForAllPriorWeeks', scoreboardForAllPriorWeeks, ['fantasy_content', 'league', 'scoreboard', 'matchups', 'matchup']);

                    // Iterate over each matchup in the scoreboard to find the records per category in a week
                    matchups.forEach(matchup => {
                        const matchupWeek = this.traversePath('matchup', matchup, ['week', '_text']);

                        if (matchup && matchupWeek < Number(currentWeek)) { // exclude current week in record calculations
                            const teams = this.traversePath('matchup', matchup, ['teams', 'team']);
                            teams.forEach(team => {

                                const teamName = this.traversePath('team', team, ['name', '_text']);
                                const teamLogoUrl = this.traversePath('standings_team', team, ['team_logos', 'team_logo', 'url', '_text']);
                                const teamStatsForMatchup = this.traversePath('team', team, ['team_stats', 'stats', 'stat']);

                                teamStatsForMatchup.forEach(teamStat => {
                                    const statId = this.traversePath('teamStat', teamStat, ['stat_id', '_text']);
                                    const statValue = this.traversePath('teamStat', teamStat, ['value', '_text']);
                                    // this._logger.debug(`checking statId ${statId} with value ${statValue} for player ${teamName}`);

                                    // Replace the record for the specific stat if the current statId matches a tracked stat and if the value
                                    // is better than the current record for that stat.
                                    if (categoryRecordsMetadata[statId] && categoryRecordsMetadata[statId].recordTotal < Number(statValue)) {
                                        categoryRecordsMetadata[statId].recordTotal = Number(statValue);
                                        categoryRecordsMetadata[statId].recordHolderName = teamName;
                                        categoryRecordsMetadata[statId].recordHolderImage = teamLogoUrl;
                                        categoryRecordsMetadata[statId].weekRecorded = matchupWeek;
                                        this._logger.debug(`replacing record for ${categoryRecordsMetadata[statId].category} with new highest value ${Number(statValue)} and new record holder ${teamName} from week ${matchupWeek}`);
                                    }
                                });
                            });
                        }
                    });

                    // Return the updated categoryRecords information
                    const highestStatInWeekRecords = Object.values(categoryRecordsMetadata);
                    resolve(highestStatInWeekRecords);
                });
        });
    }
}