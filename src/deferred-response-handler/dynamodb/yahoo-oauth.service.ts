import {Injectable} from "@nestjs/common";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
} from "@aws-sdk/lib-dynamodb";
import { LoggerDelegate } from "../../utils/logger/logger-delegate.js";
import type { DynamoDbResponse, YahooOauthCredentials } from "./interfaces/dynamodb.interfaces.js";

/**
 * Used to set and get yahoo oauth credentials from a dynamodb table for calls to the external yahoo fantasy sports api
 */
@Injectable()
export class YahooOauthService {
    private readonly _logger: LoggerDelegate;

    constructor() {
        this._logger = new LoggerDelegate(YahooOauthService.name);
    }

    public async getCredentials(): Promise<DynamoDbResponse> {
        const client = new DynamoDBClient({
            region: process.env.AWS_DYNAMO_REGION,
            endpoint: process.env.DYNAMODB_ENDPOINT
        });
        const dynamo = DynamoDBDocumentClient.from(client);
        const tableName = process.env.YAHOO_OAUTH_TABLE;

        try {
            // The table will always have a single record with up-to-date credentials, so always key id of 0
            const body = await dynamo.send(
                new GetCommand({
                    TableName: tableName,
                    Key: {
                        id: '0'
                    }
                })
            )

            return {
                status: 'success',
                result: body.Item
            };
        } catch(e) {
            this._logger.error(`Failed to get yahoo oauth data from db: ${JSON.stringify(e)}`);
            return {
                status: 'failure',
                result: null
            }
        }
    }

    public async setCredentials(newCredentials: YahooOauthCredentials): Promise<DynamoDbResponse> {
        const client = new DynamoDBClient({
            region: process.env.AWS_DYNAMO_REGION,
            endpoint: process.env.DYNAMODB_ENDPOINT
        });
        const dynamo = DynamoDBDocumentClient.from(client);
        const tableName = process.env.YAHOO_OAUTH_TABLE;

        try {
            await dynamo.send(
                new PutCommand({
                    TableName: tableName,
                    Item: newCredentials
                })
            )
            return {
                status: 'success',
                result: newCredentials
            }
        } catch(e) {
            this._logger.error(`Failed to set yahoo oauth data in db: ${JSON.stringify(e)}`);
            return {
                status: 'failure',
                result: null
            }
        }
    }
}