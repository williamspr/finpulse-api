import {Request, Response, NextFunction} from "express";
import {ZodError} from "zod";
import {AppError} from "../util/app-error.js";
import { Prisma } from '@prisma/client';
import {logger} from "../util/logger.js";

export const errorHandler = (err: Error, _req: Request, res: Response, _next: NextFunction) => {
    if(err instanceof ZodError){
        const formattedErrors = err.issues.map((e) => ({
            field: e.path.join('.'),
            message: e.message
        }));

        res.status(400).json({status: 'fail', message: 'Validation Error', errors: formattedErrors});
        return;
    }

    if(err instanceof AppError){
        res.status(err.statusCode).json({
            status: err.statusCode >= 500 ? 'error' : 'fail',
            message: err.message,
            ...(err.errors && {errors: err.errors})
        });
        return;
    }

    if(err instanceof Prisma.PrismaClientKnownRequestError){
        if(err.code === 'P2002'){
            const target = (err.meta?.target as string[]) || [];
            res.status(409).json({
                status: 'fail',
                message: `Duplicate field value: ${target.join(', ')}. Please use another value.`
            });
            return;
        }
    }

    logger.error("UNHANDLED ERROR : ", err);

    res.status(500).json({
        status: 'error',
        message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message || 'Something went wrong!'
    });
};