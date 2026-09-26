import { prisma } from "../config/prisma.js";
import { GetReportSummaryQueryInput } from "../validation/report-validation.js";
import PDFDocument from "pdfkit";
import { stringify } from "csv-stringify";
import { ExportReportQueryInput } from "../validation/report-validation.js";

export class ReportService {
    public static async getSummary(userId: string, query: GetReportSummaryQueryInput) {
        const startDate = new Date(query.startDate);
        const endDate = new Date(query.endDate);

        // Aggregate INCOME and EXPENSE transactions concurrently
        const [incomeAggregate, expenseAggregate] = await Promise.all([
            prisma.transaction.aggregate({
                _sum: {
                    amount: true
                },
                where: {
                    wallet: { userId },
                    type: "INCOME",
                    date: {
                        gte: startDate,
                        lte: endDate
                    }
                }
            }),
            prisma.transaction.aggregate({
                _sum: {
                    amount: true
                },
                where: {
                    wallet: { userId },
                    type: "EXPENSE",
                    date: {
                        gte: startDate,
                        lte: endDate
                    }
                }
            })
        ]);

        const totalIncome = Number(incomeAggregate._sum.amount || 0);
        const totalExpense = Number(expenseAggregate._sum.amount || 0);
        const netCashFlow = totalIncome - totalExpense;

        return {
            period: {
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString()
            },
            summary: {
                totalIncome,
                totalExpense,
                netCashFlow
            }
        };
    }

    public static async exportReportData(userId: string, query: ExportReportQueryInput) {
        const startDate = new Date(query.startDate);
        const endDate = new Date(query.endDate);

        // Fetch transactions along with wallet and category details
        return await prisma.transaction.findMany({
            where: {
                wallet: { userId },
                date: {
                    gte: startDate,
                    lte: endDate
                }
            },
            include: {
                wallet: { select: { name: true, currency: true } },
                targetWallet: { select: { name: true } },
                category: { select: { name: true } }
            },
            orderBy: { date: "desc" }
        });
    }

    public static generateCSVStream(transactions: any[]) {
        const stringifier = stringify({
            header: true,
            columns: [
                { key: "id", header: "Transaction ID" },
                { key: "date", header: "Date" },
                { key: "type", header: "Type" },
                { key: "amount", header: "Amount" },
                { key: "currency", header: "Currency" },
                { key: "wallet", header: "Source Wallet" },
                { key: "targetWallet", header: "Target Wallet" },
                { key: "category", header: "Category" },
                { key: "note", header: "Note" }
            ]
        });

        transactions.forEach((tx) => {
            stringifier.write({
                id: tx.id,
                date: tx.date.toISOString(),
                type: tx.type,
                amount: Number(tx.amount),
                currency: tx.currency,
                wallet: tx.wallet?.name || "",
                targetWallet: tx.targetWallet?.name || "",
                category: tx.category?.name || "-",
                note: tx.note || ""
            });
        });

        stringifier.end();
        return stringifier;
    }

    public static generatePDFStream(transactions: any[], startDate: string, endDate: string) {
        const doc = new PDFDocument({ margin: 30, size: "A4" });

        // Header Document
        doc.fontSize(18).text("FinPulse - Financial Report", { align: "center" });
        doc.moveDown(0.5);
        doc.fontSize(10).text(`Period: ${startDate.substring(0, 10)} to ${endDate.substring(0, 10)}`, { align: "center" });
        doc.moveDown(1.5);

        // Summary Table Header
        doc.fontSize(11).text("Date | Type | Wallet | Category | Amount", { underline: true });
        doc.moveDown(0.5);

        // Rows
        transactions.forEach((tx) => {
            const dateStr = tx.date.toISOString().split("T")[0];
            const typeStr = tx.type;
            const walletStr = tx.wallet?.name || "N/A";
            const categoryStr = tx.category?.name || "-";
            const amountStr = `${tx.currency} ${Number(tx.amount).toLocaleString()}`;

            doc.fontSize(9).text(`${dateStr} | ${typeStr} | ${walletStr} | ${categoryStr} | ${amountStr}`);
            doc.moveDown(0.3);
        });

        if (transactions.length === 0) {
            doc.fontSize(10).text("No transactions found for this period.", { align: "center" });
        }

        doc.end();
        return doc;
    }
}