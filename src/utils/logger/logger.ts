import * as path from 'path';
import {Singleton} from '../singleton.js';
import type { TransformableInfo } from 'logform';
import { createLogger, format, transports } from 'winston';
import {fileURLToPath} from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Order matters! The lowest number represents the highest log priority, meaning will be shown if the log level is
// set to anything with a lower priority (higher number)
export enum LogPriority {
    ERROR = 0,
    WARN = 1,
    INFO = 2,
    DEBUG = 3,
}

export enum LogLevel {
    ERROR = 'ERROR',
    WARN = 'WARN',
    INFO = 'INFO',
    DEBUG = 'DEBUG',
}

/**
 * Enables the creation of a winston logger that logs to a specific file, specified in the constructor.
 */
export abstract class Logger extends Singleton {
    private static LOG_LEVELS = {
        [LogLevel.ERROR]: LogPriority.ERROR,
        [LogLevel.WARN]: LogPriority.WARN,
        [LogLevel.INFO]: LogPriority.INFO,
        [LogLevel.DEBUG]: LogPriority.DEBUG
    };
    private static TIMESTAMP_FORMAT = 'YYYY-MM-DD HH:mm:ss';
    private readonly _logName;
    private readonly _logger;

    private constructor(fileName: string = "server.log", levelOverride?: LogLevel) {
        super();

        this._logName = fileName.trim();
        this._logger = createLogger({
            level: levelOverride || LogLevel.DEBUG,
            levels: Logger.LOG_LEVELS,
            format: format.combine(
                format.timestamp({
                    format: this.timestampFormat
                }),
                format.printf((info: TransformableInfo) => this.formatMessage(info.timestamp, info.level, info.message))
            ),
            transports: [
                new transports.File({filename: path.join(__dirname, '../../logs/', fileName), options: {flags: 'w'}})
            ]
        });
    }

    /**
     * Formats a log message so that contents are inline with each other as they are printed for easier readability
     */
    protected formatMessage(timestamp: string, logLevel: string, message: string) {
        const maxLogLevelStringLength = 5;
        const numberOfSpaces = maxLogLevelStringLength - logLevel.length;

        // Build formatted result
        let result = (`${timestamp} | ${logLevel} `);
        for (let i = 0; i < numberOfSpaces; i++) {
            result += ' ';
        }
        result += ('| ' + message);
        return result;
    }

    protected get timestampFormat() {
        return Logger.TIMESTAMP_FORMAT;
    }

    public get logger() {
        return this._logger;
    }

    public get logName() {
        return this._logName;
    }
}
