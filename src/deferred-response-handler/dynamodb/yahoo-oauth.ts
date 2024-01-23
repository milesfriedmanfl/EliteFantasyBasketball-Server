import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
} from "@aws-sdk/lib-dynamodb";

/**
 * Used to set and get yahoo oauth credentials from a dynamodb table for calls to the external yahoo fantasy sports api
 */
export class YahooOauth {
    public static async getCredentials() {
        const client = new DynamoDBClient({
            region: process.env.AWS_DYNAMO_REGION,
            endpoint: process.env.DYNAMODB_ENDPOINT
        });
        const dynamo = DynamoDBDocumentClient.from(client);
        const tableName = process.env.YAHOO_OAUTH_TABLE;

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
    }

    public static async setCredentials(newCredentials) {
        const client = new DynamoDBClient({
            region: process.env.AWS_DYNAMO_REGION,
            endpoint: process.env.DYNAMODB_ENDPOINT
        });
        const dynamo = DynamoDBDocumentClient.from(client);
        const tableName = process.env.YAHOO_OAUTH_TABLE;

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
    }
}