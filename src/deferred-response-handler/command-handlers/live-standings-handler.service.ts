import fetch from "node-fetch";
import crypto from 'crypto';
import { from, take, switchMap, catchError, combineLatest, of } from 'rxjs';
import { Injectable } from '@nestjs/common';
import {WebComponentToImageBuilder} from "../web-component-to-image-builder/web-component-to-image-builder.js";
import {YahooOauthService} from '../dynamodb/yahoo-oauth.service.js';
import {YahooFantasySportsApiService} from "../external-api/yahoo-fantasy-sports-api.service.js";
import {
    YAHOO_FANTASY_BASKETBALL_CATEGORY_IDS,
    YahooFantasySportsDataCrawler
} from "./utils/yahoo-fantasy-sports-data-crawler.js";
import type {AsyncCommandHandler} from "./interfaces/command-handler.interfaces.js";

/**
 * Handles traversing yahoo fantasy sports data and building the live standings response to update a discord slash command output
 */
@Injectable()
export class LiveStandingsHandlerService extends YahooFantasySportsDataCrawler implements AsyncCommandHandler {
    public constructor(
        protected readonly _yahooFantasySportsApi: YahooFantasySportsApiService,
        protected readonly _yahooOauthService: YahooOauthService
    ) {
        super(LiveStandingsHandlerService.name, _yahooOauthService, _yahooFantasySportsApi);
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
        this._logger.info(`Calculating live standings...`);
        const liveStandings = await this.calculateLiveStandings(accessToken);
        this._logger.info(`Creating image from web component...`);

        try {
            const liveStandingsProps = { liveStandingsAsJSON: JSON.stringify(liveStandings) };
            this._logger.debug(`stringifiedProps = ${JSON.stringify(liveStandingsProps)}`);
            const liveStandingsImageBuilder = await new WebComponentToImageBuilder(
                'LiveStandings.svelte',
                liveStandingsProps,
            );
            const imageToAttach = await liveStandingsImageBuilder.buildImage('live-standings.jpeg');
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
                                title: "Live Standings",
                                description: "If the week ended today this is what the rankings would be, without factoring in tiebreaker on win percentage",
                                image: {
                                    url: "attachment://live-standings.jpeg"
                                },
                                type: "rich"
                            }],
                            attachments: [{
                                id: 0,
                                description: "Image of the live standings",
                                filename: "live-standings.jpeg"
                            }]
                        }
                    ) + "\n\n" +
                    "--" + boundary + "\n" +
                    "Content-Disposition: form-data; name=\"files[0]\"; filename=\"live-standings.jpeg\" \n" +
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
     * Calculates the live standings based on current team records + the current status of the week.
     *
     * Steps to accomplish: (this is messy because of the way the data is formatted -__-)
     * 1. Get the current standings and copy over to liveStandings as a starting point.
     * 2. Update wins/losses/draws by sifting through matchup data and tracking this.
     * 3. Update rank by using wins/losses/draws with the yahoo formula for win percentage, as rank is primarily determined by higher win percentage.
     * 4a. If there are no teams with the same win percentage based on the above we are done, and those updated ranks are final. Resolve and return.
     * 4b. If there are teams with the same win percentage then we must make another api call for matchup data for all prior weeks.
     *     The yahoo tie-breaker is win percentage in the most recent prior week, continuing in each prior week until one team has a higher win percentage.
     * 5. The api call in 4b. will result in a concatenated list of all matchups from prior weeks, mixing them all together.
     *    Sift through that to create a mapping of (weekNumber => matchups)
     * 6. Use this mapping, starting at the most recent prior week, along with the any collisions found in step 3 (teams with same win percentage)
     *    to find the tie-breaker and update ranks accordingly. Resolve and return.
     *
     * Returns data in the form of a liveStandings object with keys that map to the internal yahoo team key.
     * liveStandings = {
     *      [teamKey]: {
     *          teamId,
     *          teamKey,
     *          teamName,
     *          rank,
     *          wins,
     *          losses,
     *          ties
     *      },
     *      ...
     * }
     */
    private async calculateLiveStandings(access_token) {
        return new Promise(resolve => {
            let liveStandings = {};
            let currentWeek;
            let startWeek;

            // Make an initial request for scoreboard data to be able to see the current week,
            // and standings data to see the current standings as of before the current week.
            combineLatest([from(this._yahooFantasySportsApi.getLeagueScoreboard(access_token)), from(this._yahooFantasySportsApi.getLeagueStandings(access_token))])
                .pipe(
                    take(1),
                    switchMap(([scoreboardData, standingsData]) => {
                        if (!scoreboardData || !standingsData) {
                            this._logger.error(`Was unable to successfully fetch league scoreboard or live standings. Please check serializedResponseBody`);
                            throw Error();
                        }

                        // 1. -- Check the standings for current records
                        const currentStandings = {}
                        currentWeek = this.traversePath('standingsData', standingsData, ['fantasy_content', 'league', 'current_week', '_text']);
                        startWeek = this.traversePath('scoreboardData', scoreboardData, ['fantasy_content', 'league', 'start_week', '_text']);
                        const standingsTeams = this.traversePath('standingsData', standingsData, ['fantasy_content', 'league', 'standings', 'teams', 'team']);
                        standingsTeams.forEach(team => {
                            const teamId = this.traversePath('standings_team', team, ['team_id', '_text']);
                            const teamKey = this.traversePath('standings_team', team, ['team_key', '_text']);
                            const teamName = this.traversePath('standings_team', team, ['name', '_text']);
                            const teamLogoUrl = this.traversePath('standings_team', team, ['team_logos', 'team_logo', 'url', '_text']);
                            const currentRank = this.traversePath('standings_team', team, ['team_standings', 'rank', '_text']);
                            const currentWins = this.traversePath('standings_team', team, ['team_standings', 'outcome_totals', 'wins', '_text']);
                            const currentLosses = this.traversePath('standings_team', team, ['team_standings', 'outcome_totals', 'losses', '_text']);
                            const currentTies = this.traversePath('standings_team', team, ['team_standings', 'outcome_totals', 'ties', '_text']);
                            currentStandings[teamKey] = { // TODO -- make this an interface
                                teamId,
                                teamKey,
                                teamName,
                                teamLogoUrl,
                                rank: currentRank,
                                wins: currentWins,
                                losses: currentLosses,
                                ties: currentTies
                            }
                        });
                        this._logger.debug(`currentStandings prior to week ${currentWeek} = ${JSON.stringify(currentStandings)}`);
                        liveStandings = {...currentStandings}; // first copy over current standings as the starting point for live standings.

                        /* 2. -- UPDATING liveStandings.w/l/t -- */
                        // Check the tentative wins/losses/draws for the current week within each matchup using scoreboardData,
                        // then calculate live standings using those tentative records and currentStandings.
                        const matchups = this.traversePath('standingsData', scoreboardData, ['fantasy_content', 'league', 'scoreboard', 'matchups', 'matchup']);
                        matchups.forEach(matchup => {
                            const matchupTeams = this.traversePath('matchup', matchup, ['teams', 'team']);
                            const matchupStatWinners = this.traversePath('matchup', matchup, ['stat_winners', 'stat_winner']);
                            const keysOfTeamsInMatchup = [];

                            matchupTeams.forEach(team => {
                                const matchupTeamKey = this.traversePath('matchup_team', team, ['team_key', '_text']);
                                keysOfTeamsInMatchup.push(matchupTeamKey);
                            });

                            // Meant to catch errors that should never occur
                            if (keysOfTeamsInMatchup.length !== 2) { this._logger.error(`Invariant error: keysOfTeamsInMatchup array is larger than size 2 suggesting matchups with more than 2 players. There must be an error.`); }
                            if (matchupStatWinners && matchupStatWinners.length !== 9) { this._logger.error(`Invariant error: found more or less stats than 9. This suggests there is an error.`); }

                            // update live standings wins/losses/draws based on the live results of the current stat winner
                            matchupStatWinners.forEach(stat => {
                                const winnerTeamKey = this.traversePath('stat', stat, ['winner_team_key', '_text']);
                                const isTied = (!winnerTeamKey) && this.traversePath('stat', stat, ['is_tied', '_text']) == '1';

                                keysOfTeamsInMatchup.forEach(teamKey => {
                                    if (teamKey === winnerTeamKey) { // team is winning this stat
                                        liveStandings[teamKey].wins++;
                                    } else if (isTied) { // team is currently tied in this stat
                                        liveStandings[teamKey].ties++;
                                    } else { // team is losing this stat
                                        liveStandings[teamKey].losses++;
                                    }
                                });
                            });
                        });

                        /* 3. -- UPDATING liveStandings.winPercentage -- */
                        // Next update of the live standings winPercentage using yahoo's algorithm for calculating rank considering wins/losses/ties, and tie-breakers:
                        // (Wins + [Ties * 0.5]) / Total Games Played = Winning Percentage --- Not sure what "Total Games Played" means so let's assume the same for everyone aka denominator of 1
                        //
                        // Note: uniqueWinPercentageToTeamsMapping is an object mapping a specific win percentage to all teams with that win percentage. It is
                        // populated along the way to be able to track collisions in the next step.
                        const uniqueWinPercentageToTeamsMapping = {} /* winPercentage: { teamKeys: [] } */
                        for (let [teamKey, teamValues] of Object.entries(liveStandings)) {
                            const wins = (teamValues as any).wins; // TODO -- replace any with an interface
                            const ties = (teamValues as any).ties; // TODO -- replace any with an interface
                            const winPercentage = (Number(wins) + (Number(ties) * .5)); // yahoo formula for win percentage
                            liveStandings[teamKey].winPercentage = winPercentage;

                            // Storing all teams that have the same win percentage in an array linked to that win percentage.
                            if (uniqueWinPercentageToTeamsMapping[winPercentage] && uniqueWinPercentageToTeamsMapping[winPercentage].teamKeys) {
                                uniqueWinPercentageToTeamsMapping[winPercentage].teamKeys.push(teamKey);
                            } else {
                                uniqueWinPercentageToTeamsMapping[winPercentage] = { teamKeys: [teamKey] };
                            }
                        }

                        /* 3 cont. -- UPDATING liveStandings.rank (not factoring in ties) -- */
                        // Next update live standing ranks based on win percentage. If there is a tie in win percentage we must make another call for scorebords
                        // of prior weeks, but we still want to update ranks prior to the consideration of these ties as a preliminray step towards
                        // determining accurate live standings.
                        const winPercentagesSorted = Object.keys(uniqueWinPercentageToTeamsMapping).sort((a, b) => { // sort by win percentage highest to lowest
                            return (Number(a) > Number(b))
                                ? -1 // a should come before b
                                : 1 // a should go after b
                        });
                        let iteratedRank = 1;
                        winPercentagesSorted.forEach((winPercentage) => {
                            const teamsThatShareCurrentRank = uniqueWinPercentageToTeamsMapping[winPercentage].teamKeys;
                            const teamCountForRank = teamsThatShareCurrentRank.length;
                            // teams that share a win percentage will be given the same rank in this step, but the overall iterated rank will be increased to factor
                            // in all of these teams being above the next best.
                            // (i.e. if two teams share rank 2, then the team with the next highest win percentage will be rank 4)
                            teamsThatShareCurrentRank.forEach(teamKey => {
                                liveStandings[teamKey].rank = iteratedRank;
                            });
                            iteratedRank += teamCountForRank;
                        });
                        // error checking that iterated rank is 12, accounting for all teams
                        if (iteratedRank !== 12) { this._logger.error(`Calculation error: mistake made when updating live rankings through initial pass of win collisions.`); }


                        /* 4a. + 4b. Determine if tie-breaker is needed and proceed */
                        // If there are less than 12 unique win percentages, then we must have win-percentage ties or collisions, which means we need to make another call
                        // for prior scoreboard data. As of the time of coding the yahoo tie-breaker regular season is win percentage in the prior week, repeating until
                        // a higher win percentage is found.
                        const teamSize = 12; // this has always been the case so ok to hard code I think
                        if (winPercentagesSorted.length < teamSize) {
                            // Filter uniqueWinPercentages to find only win percentages shared by multiple teams
                            // End result converts the uniqueWinPercentagesToTeams mapping to an array of arrays, where each sub-array is a list of teams that share
                            // the same win percentage.
                            //
                            // For example: (winPercentageCollisions) =
                            // [
                            //      [team1, team2, team3],
                            //      [team4, team5]
                            // ]
                            const winPercentageCollisions = Object.entries(uniqueWinPercentageToTeamsMapping).filter(([winPercentage, value]) => {
                                return (value as any).teamKeys.length > 0
                            }).map(([winPercentage, value]) => {
                                return value;
                            });

                            this._logger.debug(`liveStandings with collisions before tie-breakers = ${JSON.stringify(liveStandings)}`);

                            // Make request for scoreboard data for all prior weeks than the current
                            return combineLatest([
                                of(true), // isFurtherProcessingNeeded
                                from(this._yahooFantasySportsApi.getLeagueScoreboardByWeek(access_token, this.allPriorWeeksQueryParam(Number(currentWeek), Number(currentWeek) - 1))), // scoreboardData for all prior weeks so we can handle collisions
                                of(winPercentageCollisions), // pass along collisions for processing,
                                of(liveStandings), // currently calculated live standings
                            ]);

                        } else {
                            // Otherwise if there are no collisions than the current live standings must be correct! Pass it along with null values for other variables
                            // related to processing tie-breakers
                            this._logger.debug(`liveStandings with no collisions = ${JSON.stringify(liveStandings)}`);
                            return combineLatest([
                                of(false), // isFurtherProcessingNeeded,
                                of(null), // additional api results -- none needed
                                of(null), // win percentage collisions -- none
                                of(liveStandings) // fully-processed and calculated liveStandings to pass along
                            ]);
                        }
                    }),
                    catchError((_: any) => {
                        this._logger.error(`Failed to fetch data to calculate live standings.`);
                        return of([null, null, null, null]);
                    })
                )
                // Pass along the live standings if there were no winPercentageCollisions, otherwise process tie-breaker logic on scoreboardData for all prior weeks.
                .subscribe(([isFurtherProcessingNeeded, allPriorScoreboardData, winPercentageCollisions, liveStandings]) => {
                    // No tie-breakers to consider
                    if (!isFurtherProcessingNeeded) {
                        resolve(liveStandings);
                    }

                    if (!liveStandings) {
                        resolve(null);
                    }

                    this._logger.debug(`allPriorScoreboardData = ${JSON.stringify(allPriorScoreboardData)}`);
                    this._logger.debug(`winPercentageCollisions = ${JSON.stringify(winPercentageCollisions)}`);
                    this._logger.debug(`calculated liveStandings = ${JSON.stringify(liveStandings)}`);
                    resolve(liveStandings);

                    // TODO -- handle tiebreakers if desired later
                });
        });
    }
}
