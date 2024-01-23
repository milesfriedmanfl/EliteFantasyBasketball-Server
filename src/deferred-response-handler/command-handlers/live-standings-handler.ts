import fetch from "node-fetch";
import { from, take, switchMap, catchError, combineLatest, of } from 'rxjs';
import {LoggerDelegate} from "../../utils/logger/logger-delegate.js";
import {WebComponentToImageBuilder} from "../web-component-to-image-builder/web-component-to-image-builder.js";
import {YahooOauth} from '../dynamodb/yahoo-oauth.js';
import {YahooFantasySportsApi} from "../external-api/yahoo-fantasy-sports-api.js";
import type {AsyncCommandHandler} from "./interfaces/command-handler-interfaces.js";
import crypto from 'crypto';

export class LiveStandingsHandler implements AsyncCommandHandler {
    private readonly _logger: LoggerDelegate;
    private readonly _yahooFantasySportsApi: YahooFantasySportsApi;
    
    public constructor() {
        this._logger = new LoggerDelegate(LiveStandingsHandler.name);
        this._yahooFantasySportsApi = new YahooFantasySportsApi();
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
            this._logger.debug(`stringifiedProps = ${liveStandingsProps}`);
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
     * Traverses a passed object for the field of interest and returns the value of that field. If this is an object then an object will be returned,
     * but this is meant to be used to find terminal values in the large tree of yahoo fantasy sports api return data.
     *
     * Returns null if the field was not found and logs an error.
     *
     * @Param objectName - the name of the object for logging purposes
     * @Param jsObject - the object to traverse
     * @Param fieldPath - an array representing the path from the root of the object to the field in question
     */
    private traversePath(objectName, jsObject, fieldPath) {
        return fieldPath.reduce((objectNode, field) => {
            // Traverse the object tree checking for null at each field node and returning an object that uses that field sub-object
            // as the root until we reach the current_week.
            if (!objectNode) {
                this._logger.error(`Error in this.traversePath(): Unable to locate ${JSON.stringify(fieldPath)} in ${objectName} object!`);
                return null;
            }
            return (objectNode[field]) ? objectNode[field] : null;
        }, jsObject);
    }

    /**
     * Goes through the process of authorizing with the yahoo api using oauth credentials, refreshing the credentials if they are close to or past expiry as needed
     */
    private async getYahooAccessToken() {
        this._logger.debug('Entered getYahooAccessToken()');
        
        // Retrieve current oauth credentials and check validity
        // const getCredentialsResponse = await yahooOauthDatabaseTable.getYahooOauthCredentials();
        this._logger.info('Fetching credentials from db...');
        const getCredentialsResponse = await YahooOauth.getCredentials();
        const currentOauthCredentials = (getCredentialsResponse) ? getCredentialsResponse.result : null;
        this._logger.debug(`currentOauthCredentials = ${JSON.stringify(currentOauthCredentials)}`);

        // If token is not valid then refresh it using the current stored credentials.
        // To determine validity check the time for expiry.
        // Assume the token is invalid if there is no time field in the current credentials.
        const maxCredentialValidityPeriodInSeconds = 3600; // assume 3600 as the time a token is valid, as that is currently the case at the time of coding
        const tokenTimeSeconds = currentOauthCredentials.token_time_seconds;
        const currentTimeInSeconds = new Date().getTime() / 1000; // getTime() returns milliseconds so divide by 1000
        const oneMinuteBeforeExpiry = (currentOauthCredentials.expires_in && currentOauthCredentials.expires_in > 60)
            ? currentOauthCredentials.expires_in - 60 // seconds
            : (maxCredentialValidityPeriodInSeconds - 60)
        if (currentOauthCredentials &&
            !tokenTimeSeconds || // if we don't have a timestamp assigned with our credentials (this is not added by calls by default so this should only be the case for calls made external to this code)
            currentTimeInSeconds - tokenTimeSeconds > oneMinuteBeforeExpiry // token at, or close to expiry
        ) {
            this._logger.info(`Credentials at or close to expiry. Refreshing credentials...`);
            // Refresh token
            // TODO -- test output and make an interface to replace any
            const refreshResponseObj: any = await this._yahooFantasySportsApi.refreshYahooOauthAccessToken(currentOauthCredentials);
            this._logger.info(`Refreshed credentials. Saving new credentials...`);

            // Save new credentials
            const newCredentials = {
                id: '0', // The database will only ever have one row. All requests under the same app-level auth. So always use 0
                token_time_seconds: currentTimeInSeconds,
                consumer_key: currentOauthCredentials.consumer_key,
                consumer_secret: currentOauthCredentials.consumer_secret,
                ...refreshResponseObj
            }
            const {status, result} = await YahooOauth.setCredentials(newCredentials);
            this._logger.info(`Credentials saved in dynamodb: status = ${status}, result = ${JSON.stringify(result)}`);

            // Return new access_token
            return result.access_token
        }

        // Otherwise return current access_token
        return currentOauthCredentials.access_token;
    }

    /**
     * Calculates the current record for total count in a week for each category and returns an object that contains: (stat, record, record_holder)
     */
    public async calculateWeeklyTotalRecordHolders(access_token) {
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

                        // TODO -- this is repeated code, make it a function
                        // Build the week specifier string containing all weeks prior to the current.
                        // This will be the value for the weeks sub-resource query param
                        let allPriorWeeksQueryParam = '';
                        for (let weekNum = startWeek; weekNum < currentWeek; weekNum++) {
                            allPriorWeeksQueryParam += (weekNum < currentWeek - 1)
                                ? `${weekNum},`
                                : `${weekNum}`;
                        }
                        // --------------------------------------------------
                        // Make request for scoreboard data for all prior weeks than the current
                        return from(this._yahooFantasySportsApi.getLeagueScoreboardByWeek(access_token, allPriorWeeksQueryParam));
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
                    const categoryRecordsMetadata = {  // ignore efficiency cats
                        [process.env.YAHOO_STAT_ID_THREES]: {
                            name: 'threes',
                            recordTotal: 0,
                            recordHolder: null,
                        },
                        [process.env.YAHOO_STAT_ID_POINTS]: {
                            name: 'points',
                            recordTotal: 0,
                            recordHolder: null,
                        },
                        [process.env.YAHOO_STAT_ID_REBOUNDS]: {
                            name: 'rebounds',
                            recordTotal: 0,
                            recordHolder: null,
                        },
                        [process.env.YAHOO_STAT_ID_ASSISTS]: {
                            name: 'assists',
                            recordTotal: 0,
                            recordHolder: null,
                        },
                        [process.env.YAHOO_STAT_ID_STEALS]: {
                            name: 'steals',
                            recordTotal: 0,
                            recordHolder: null,
                        },
                        [process.env.YAHOO_STAT_ID_BLOCKS]: {
                            name: 'blocks',
                            recordTotal: 0,
                            recordHolder: null,
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
                                const teamStatsForMatchup = this.traversePath('team', team, ['team_stats', 'stats', 'stat']);
                                
                                teamStatsForMatchup.forEach(teamStat => {
                                    const statId = this.traversePath('teamStat', teamStat, ['stat_id', '_text']);
                                    const statValue = this.traversePath('teamStat', teamStat, ['value', '_text']);
                                    // this._logger.debug(`checking statId ${statId} with value ${statValue} for player ${teamName}`);

                                    // Replace the record for the specific stat if the current statId matches a tracked stat and if the value
                                    // is better than the current record for that stat.
                                    if (categoryRecordsMetadata[statId] && categoryRecordsMetadata[statId].recordTotal < Number(statValue)) {
                                        categoryRecordsMetadata[statId].recordTotal = Number(statValue);
                                        categoryRecordsMetadata[statId].recordHolder = teamName;
                                        // this._logger.debug(`replacing record for ${categoryRecordsMetadata[statId].name} with new highest value ${Number(statValue)} and new record holder ${teamName}`);
                                    }
                                });
                            });
                        }
                    });

                    // Return the updated categoryRecords information
                    resolve(categoryRecordsMetadata);
                });
        });
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
                            const winPercentage = (wins + (ties * .5)) / 1; // yahoo formula for win percentage
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

                            // TODO -- this is repeated code, make it a function
                            // Build the week specifier string containing all weeks prior to the current.
                            // This will be the value for the weeks sub-resource query param
                            let allPriorWeeksQueryParam = '';
                            for (let weekNum = startWeek; weekNum < currentWeek; weekNum++) {
                                allPriorWeeksQueryParam += (weekNum < currentWeek - 1)
                                    ? `${weekNum},`
                                    : `${weekNum}`;
                            }
                            // --------------------------------------------------

                            this._logger.debug(`liveStandings with collisions before tie-breakers = ${JSON.stringify(liveStandings)}`);

                            // Make request for scoreboard data for all prior weeks than the current
                            return combineLatest([
                                of(true), // isFurtherProcessingNeeded
                                from(this._yahooFantasySportsApi.getLeagueScoreboardByWeek(access_token, allPriorWeeksQueryParam)), // scoreboardData for all prior weeks so we can handle collisions
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

                    this._logger.debug(`calculated liveStandings = ${JSON.stringify(liveStandings)}`);
                    resolve(liveStandings);

                    // TODO -- handle tiebreakers if desired later
                });
        });
    }
}
