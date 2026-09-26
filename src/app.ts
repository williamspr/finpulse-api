import express, {Application, Request, Response} from "express";
import cookieParser from "cookie-parser";
import {AppError} from "./util/app-error.js";
import {errorHandler} from "./middleware/error-handler.js";
import authRoute from "./route/auth-route.js";
import walletRoute from "./route/wallet-route.js";
import categoryRouter from "./route/category-route.js";
import transactionRouter from "./route/transaction-route.js";

const app: Application = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/api/v1/auth', authRoute);
app.use('/api/v1/wallets', walletRoute);
app.use("/api/v1/categories", categoryRouter);
app.use("/api/v1/transactions", transactionRouter);

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