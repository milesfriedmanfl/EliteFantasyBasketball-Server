import {LoggerDelegate} from "../../../utils/logger/logger-delegate.js";
import {YahooOauthService} from "../../dynamodb/yahoo-oauth.service.js";
import {YahooFantasySportsApiService} from "../../external-api/yahoo-fantasy-sports-api.service.js";
import type {YahooOauthCredentials} from "../../dynamodb/interfaces/dynamodb.interfaces.js";

/**
 * Category IDs assigned by the Yahoo Fantasy Sports API. May change in the future
 */
export enum YAHOO_FANTASY_BASKETBALL_CATEGORY_IDS {
    YAHOO_STAT_ID_ASSISTS =	16,
    YAHOO_STAT_ID_BLOCKS = 18,
    YAHOO_STAT_ID_FG = 5,
    YAHOO_STAT_ID_FT = 8,
    YAHOO_STAT_ID_POINTS = 12,
    YAHOO_STAT_ID_REBOUNDS = 15,
    YAHOO_STAT_ID_STEALS = 17,
    YAHOO_STAT_ID_THREES = 10,
    YAHOO_STAT_ID_TOS = 19
}

/**
 * Instances of this class are designed to be able to query the yahoo fantasy sports api and navigate returned layered
 * data sets easily. Examples of the way their data is organized and returned can be found here:
 * https://developer.yahoo.com/fantasysports/guide/
 */
export abstract class YahooFantasySportsDataCrawler {
    protected readonly _logger: LoggerDelegate;
    protected readonly _yahooOauthService: YahooOauthService;
    protected readonly _yahooFantasySportsApiService: YahooFantasySportsApiService;

    protected constructor(loggerName: string, yahooOauthService: YahooOauthService, yahooSportsApiService: YahooFantasySportsApiService) {
        this._logger = new LoggerDelegate(loggerName);
        this._yahooOauthService = yahooOauthService;
        this._yahooFantasySportsApiService = yahooSportsApiService;
    }

    /**
     * Goes through the process of authorizing with the yahoo api using oauth credentials, refreshing the credentials if they are close to or past expiry as needed
     */
    protected async getYahooAccessToken() {
        this._logger.debug('Entered getYahooAccessToken()');

        // Retrieve current oauth credentials and check validity
        // const getCredentialsResponse = await yahooOauthDatabaseTable.getYahooOauthCredentials();
        this._logger.info('Fetching credentials from db...');
        const getCredentialsResponse = await this._yahooOauthService.getCredentials();
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
            const refreshResponseObj: any = await this._yahooFantasySportsApiService.refreshYahooOauthAccessToken(currentOauthCredentials);
            this._logger.info(`Refreshed credentials. Saving new credentials...`);

            // Save new credentials
            const newCredentials: YahooOauthCredentials = {
                id: '0', // The database will only ever have one row. All requests under the same app-level auth. So always use 0
                token_time_seconds: currentTimeInSeconds,
                consumer_key: currentOauthCredentials.consumer_key,
                consumer_secret: currentOauthCredentials.consumer_secret,
                ...refreshResponseObj
            }
            const {status, result} = await this._yahooOauthService.setCredentials(newCredentials);
            this._logger.info(`Credentials saved in dynamodb: status = ${status}, result = ${JSON.stringify(result)}`);

            // Return new access_token
            return result.access_token
        }

        // Otherwise return current access_token
        return currentOauthCredentials.access_token;
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
    protected traversePath(objectName, jsObject, fieldPath) {
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
     * Builds a query param that asks for data from all prior weeks
     */
    protected allPriorWeeksQueryParam(currentWeek: number, startWeek: number) {
        let allPriorWeeksQueryParam = '';
        for (let weekNum = startWeek; weekNum < currentWeek; weekNum++) {
            allPriorWeeksQueryParam += (weekNum < currentWeek - 1)
                ? `${weekNum},`
                : `${weekNum}`;
        }
        return allPriorWeeksQueryParam;
    }
}