import { xml2js } from "xml-js";
import {Injectable} from "@nestjs/common";
import fetch from 'node-fetch';
import {LoggerDelegate} from "../../utils/logger/logger-delegate.js";

/**
 * Used to fetch data from the yahoo fantasy sports api
 */
@Injectable()
export class YahooFantasySportsApiService {
    private readonly _logger: LoggerDelegate;

    public constructor() {
        this._logger = new LoggerDelegate(YahooFantasySportsApiService.name);
    }

    /**
     * Refreshes yahoo oauth credentials using current credentials and refresh token. Returns the new access token.
     *
     * NOTE: This function assumes that you have initially authenticated at least once and have populated currentOauthCredentials
     * with required variables consumer_key, consumer_secret, and refresh_token.
     *
     * Example url: https://api.login.yahoo.com/oauth2/get_token
     * Http Method: POST
     * Request Payload: 'client_id={}&client_secret={}&...'
     * Native Response: JSON
     *
     * @param currentOauthCredentials - the database credentials object
     */
    public async refreshYahooOauthAccessToken(currentOauthCredentials) {
        this._logger.debug(`Entered refreshYahooOauthAccessToken: currentOauthCredentials = ${JSON.stringify(currentOauthCredentials)}`)

        // 1. -- Build request headers/params
        this._logger.info(`Building request/header params...`);
        const encoded_auth = (currentOauthCredentials)
            ? Buffer.from(`${currentOauthCredentials.consumer_key}:${currentOauthCredentials.consumer_secret}`, 'utf8').toString('base64')
            : null;
        if (!encoded_auth) {
            this._logger.error(`[ERROR] Failed to encode authorization header for refreshYahooOauthAccessToken()`);
            throw new Error(`[ERROR] Failed to encode authorization header for refreshYahooOauthAccessToken()`);
        }
        this._logger.debug(`encoded_auth = ${encoded_auth}`);

        const auth_headers = {
            'Authorization': `Basic ${encoded_auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        }
        this._logger.debug(`auth_headers = ${JSON.stringify(auth_headers)}`);

        const body_props = {
            client_id: currentOauthCredentials.consumer_key,
            client_secret: currentOauthCredentials.consumer_secret,
            refresh_token: currentOauthCredentials.refresh_token,
            redirect_uri: 'oob', // out of bounds (should always be this value)
            grant_type: 'refresh_token' // we are refreshing the current access token (should always be this value)
        }

        // 2. -- Send request and return
        this._logger.info(`Authenticating with yahoo fantasy sports api...`);
        const response = await fetch('https://api.login.yahoo.com/oauth2/get_token', {
            method: 'POST',
            body: `client_id=${body_props.client_id}&client_secret=${body_props.client_secret}&refresh_token=${body_props.refresh_token}&redirect_uri=${body_props.redirect_uri}&grant_type=${body_props.grant_type}`,
            headers: auth_headers
        });
        const refresh_response_obj = await response.json();

        this._logger.debug('refresh_token response = ' + JSON.stringify(refresh_response_obj));

        return refresh_response_obj;
    }

    /**
     * Used to get the request the scoreboard resource for a specific league from the yahoo fantasy sports api.
     *
     * Data is returned from the api natively as XML. This function converts the response data into a JS object before returning it to the caller.
     *
     * Example url: https://fantasysports.yahooapis.com/fantasy/v2/league/nba.l.{league_id}}/scoreboard
     * HTTP Method: GET
     * Native Response: XML
     */
    public async getLeagueScoreboard(access_token) {
        this._logger.debug(`Entered getLeagueScoreboard: access_token = ${access_token}`);

        // 1. -- Build request headers/params
        this._logger.info(`Building request/header params...`);
        const auth_headers = {
            'Authorization': `Bearer ${access_token}`
        }

        // 2. -- Send request
        this._logger.info(`Sending request for scoreboard data...`);
        const response = await fetch(`https://fantasysports.yahooapis.com/fantasy/v2/league/nba.l.${process.env.LEAGUE_ID}/scoreboard`, {
            method: 'GET',
            headers: auth_headers
        });

        // 3. -- Format response to a JS object and return
        this._logger.info(`Parsing response from request for scoreboard data...`);
        const serializedResponseBody = (response) ? xml2js(await response.text(), {compact: true, ignoreComment: true}) : null;
        this._logger.debug(`serializedResponseBody for getLeagueScoreboard = ${JSON.stringify(serializedResponseBody)}`);

        return serializedResponseBody;
    }

    /**
     * Used to get the request the scoreboard resource for a specific league from the yahoo fantasy sports api, specifically for the weeks specified by the week sub-resource.
     *
     * Data is returned from the api natively as XML. This function converts the response data into a JS object before returning it to the caller.
     *
     * Example url: https://fantasysports.yahooapis.com/fantasy/v2/league/nba.l.{league_id}}/scoreboard;week={1,2,3...}
     * HTTP Method: GET
     * Native Response: XML
     */
    public async getLeagueScoreboardByWeek(access_token, week_numbers) {
        this._logger.debug(`Entered getLeagueScoreboardByWeek: access_token = ${access_token}, week_numbers = ${week_numbers}`);

        // 1. -- Build request headers/params
        this._logger.info(`Building request/header params...`);
        const auth_headers = {
            'Authorization': `Bearer ${access_token}`
        }

        // 2. -- Send request
        this._logger.info(`Sending request for scoreboard data by week...`);
        const response = await fetch(`https://fantasysports.yahooapis.com/fantasy/v2/league/nba.l.${process.env.LEAGUE_ID}/scoreboard;week=${week_numbers}`, {
            method: 'GET',
            headers: auth_headers
        });

        // 3. -- Format response to a JS object and return
        this._logger.info(`Parsing response from request for scoreboard data...`);
        const serializedResponseBody = (response) ? xml2js(await response.text(), {compact: true, ignoreComment: true}) : null;
        this._logger.debug(`serializedResponseBody for getLeagueScoreboardByWeek = ${JSON.stringify(serializedResponseBody)}`);

        return serializedResponseBody;
    }

    /**
     * Used to get the request the standings resource for a specific league from the yahoo fantasy sports api.
     *
     * Data is returned from the api natively as XML. This function converts the response data into a JS object before returning it to the caller.
     *
     * Example url: https://fantasysports.yahooapis.com/fantasy/v2/league/nba.l.{league_id}/standings
     * HTTP Method: GET
     * Native Response: XML
     */
    public async getLeagueStandings(access_token) {
        this._logger.debug(`Entered getLeagueStandings: access_token = ${access_token}`);

        // 1. -- Build request headers/params
        this._logger.info(`Building request/header params...`);
        const auth_headers = {
            'Authorization': `Bearer ${access_token}`
        }

        // 2. -- Send request
        this._logger.info(`Sending request for league standings...`);
        this._logger.debug(`league_id = ${process.env.LEAGUE_ID}`)
        const response = await fetch(`https://fantasysports.yahooapis.com/fantasy/v2/league/nba.l.${process.env.LEAGUE_ID}/standings`, {
            method: 'GET',
            headers: auth_headers
        });

        // 3. -- Format response to a JS object and return
        const serializedResponseBody = (response) ? xml2js(await response.text(), {compact: true, ignoreComment: true}) : null;
        this._logger.debug(`serializedResponseBody for getLeagueStandings = ${JSON.stringify(serializedResponseBody)}`);
        return serializedResponseBody;
    }
}
