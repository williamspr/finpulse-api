export class AppError extends Error {
    constructor(message: string, public readonly statusCode: number = 500,
                public readonly isOperational: boolean = true, public readonly errors?: Record<string, unknown> | unknown[]) {
        super(message);

        Object.setPrototypeOf(this, new.target.prototype);
        Error.captureStackTrace(this, this.constructor);
    }
}