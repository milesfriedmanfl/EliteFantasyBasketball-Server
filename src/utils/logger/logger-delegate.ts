import {Logger, LogLevel} from './logger.js';

export class LoggerDelegate {
    private readonly _name;
    private readonly _logger;

    /**
     * Creates a new LoggerDelegate which houses the name of the class the delegate is logging for, along with
     * the winston logger singleton to log to for the passed class.
     */
    public constructor(className: string) {
        this._logger = (Logger.Instance as Logger).logger;
        this._name = className;
    }

    /**
     * Returns the message passed as the parameter with the name of the logger prepended for easier tracking of the
     * origin of log message. Formats the string so that all log messages will be lined up.
     */
    private prependClassName(message: string): string {
        const maxClassNameStringLength = 30; // Picking something that should be long enough for any class I'd create
        const numberOfSpaces = maxClassNameStringLength - this._name.length;

        // Build formatted result
        let result = this._name + ' ';
        for (let i = 0; i < numberOfSpaces; i++) {
            result += ' ';
        }
        result += ('| ' + message);
        return result;
    }

    /**
     * Logs a message with the passed level, first prepending the class name to the message
     */
    public log(level: LogLevel, message: string) {
        const enhancedMessage = this.prependClassName(message);
        this._logger.log(level, enhancedMessage);
    }

    /**
     * Logs a message with a log level of: ERROR
     */
    public error(message: string) {
        const enhancedMessage = this.prependClassName(message);
        this._logger.log(LogLevel.ERROR, enhancedMessage);
    }

    /**
     * Logs a message with a log level of: WARN
     */
    public warn(message: string) {
        const enhancedMessage = this.prependClassName(message);
        this._logger.log(LogLevel.WARN, enhancedMessage);
    }

    /**
     * Logs a message with a log level of: INFO
     */
    public info(message: string) {
        const enhancedMessage = this.prependClassName(message);
        this._logger.log(LogLevel.INFO, enhancedMessage);
    }

    /**
     * Logs a message with a log level of: DEBUG
     */
    public debug(message: string) {
        const enhancedMessage = this.prependClassName(message);
        this._logger.log(LogLevel.DEBUG, enhancedMessage);
    }
}
