import { Request, Response, NextFunction } from "express";
import { ReportService } from "../service/report-service.js";
import {ExportReportQueryInput} from "../validation/report-validation.js";

export class ReportController {
    public static async getSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const query = req.query as unknown as { startDate: string; endDate: string };

            const summary = await ReportService.getSummary(userId, query);

            res.status(200).json({
                status: "success",
                data: summary
            });
        } catch (error) {
            next(error);
        }
    }

    public static async exportReport(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.userId;
            const query = req.query as unknown as ExportReportQueryInput;

            const transactions = await ReportService.exportReportData(userId, query);

            if (query.format === "csv") {
                res.setHeader("Content-Type", "text/csv");
                res.setHeader("Content-Disposition", `attachment; filename="financial-report-${Date.now()}.csv"`);

                const csvStream = ReportService.generateCSVStream(transactions);
                csvStream.pipe(res);
            } else if (query.format === "pdf") {
                res.setHeader("Content-Type", "application/pdf");
                res.setHeader("Content-Disposition", `attachment; filename="financial-report-${Date.now()}.pdf"`);

                const pdfStream = ReportService.generatePDFStream(transactions, query.startDate, query.endDate);
                pdfStream.pipe(res);
            }
        } catch (error) {
            next(error);
        }
    }
}