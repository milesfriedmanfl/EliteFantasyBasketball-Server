export interface DynamoDbResponse {
    status: 'success' | 'failure';
    result: any;
}

export interface YahooOauthCredentials {
    id: string;
    access_token: string;
    consumer_key: string;
    consumer_secret: string;
    expires_in: number;
    refresh_token: string;
    token_time_seconds: string;
}