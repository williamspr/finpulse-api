import winston from "winston";

const logFormat = winston.format.combine(
    winston.format.timestamp({format : 'YYYY-MM-DD HH:mm:ss'}),
    winston.format.errors({stack : true}),
    winston.format.json()
);

export const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
    format: logFormat,
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.printf(({timestamp, level, message, stack}) => {
                    return `[${timestamp}] ${level}: ${message}${stack ? `\n${stack}` : ''}`;
                })
            )
        })
    ]
});