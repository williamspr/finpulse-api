import express, {Application, Request, Response} from "express";
import {AppError} from "./util/app-error.js";
import {errorHandler} from "./middleware/error-handler.js";

const app: Application = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check Endpoint
app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
        status: 'success',
        message: 'FinPulse API is running smoothly',
        timestamp: new Date().toISOString()
    });
});

//Handle Unknown Routes (404)
app.all('/{*splat}', (req: Request, _res: Response, next) => {
    next(new AppError(`Can't find ${req.originalUrl} on this server`, 404));
});

app.use(errorHandler);

export default app;