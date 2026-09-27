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
        const doc = new PDFDocument({ margin: 40, size: "A4" });

        // 1. Header Document
        doc.fillColor("#111827").fontSize(22).font("Helvetica-Bold").text("FinPulse", { align: "center" });

        doc.fontSize(11).font("Helvetica").fillColor("#4B5563").text("Financial Statement & Report", { align: "center" });

        doc.moveDown(0.2);
        doc.fontSize(9).fillColor("#6B7280").text(`Period: ${startDate.substring(0, 10)} to ${endDate.substring(0, 10)}`, { align: "center" });

        // 2. Financial Summary Block
        let totalIncome = 0;
        let totalExpense = 0;

        transactions.forEach((tx) => {
            const amt = Number(tx.amount) || 0;
            if (tx.type === "INCOME") totalIncome += amt;
            if (tx.type === "EXPENSE") totalExpense += amt;
        });

        const netCashFlow = totalIncome - totalExpense;

        doc.moveDown(1);
        const summaryY = doc.y;

        // Draw Summary Background Card
        doc.roundedRect(40, summaryY, 515, 45, 6).fillAndStroke("#F9FAFB", "#E5E7EB");

        // Income
        doc.fillColor("#059669").fontSize(8).font("Helvetica-Bold").text("TOTAL INCOME", 60, summaryY + 8);
        doc.fillColor("#111827").fontSize(10).font("Helvetica").text(`IDR ${totalIncome.toLocaleString()}`, 60, summaryY + 22);

        // Expense
        doc.fillColor("#DC2626").fontSize(8).font("Helvetica-Bold").text("TOTAL EXPENSE", 230, summaryY + 8);
        doc.fillColor("#111827").fontSize(10).font("Helvetica").text(`IDR ${totalExpense.toLocaleString()}`, 230, summaryY + 22);

        // Net Cash Flow
        const netColor = netCashFlow >= 0 ? "#2563EB" : "#DC2626";
        doc.fillColor(netColor).fontSize(8).font("Helvetica-Bold").text("NET CASH FLOW", 400, summaryY + 8);
        doc.fillColor("#111827").fontSize(10).font("Helvetica").text(`IDR ${netCashFlow.toLocaleString()}`, 400, summaryY + 22);

        doc.y = summaryY + 60;

        // 3. Table Column Layout
        const tableTop = doc.y;
        const colX = {
            date: 40,
            type: 120,
            wallet: 190,
            category: 310,
            amount: 430
        };

        const drawDivider = (y: number, color = "#E5E7EB") => {
            doc.strokeColor(color).lineWidth(1).moveTo(40, y).lineTo(555, y).stroke();
        };

        // Table Header
        doc.fontSize(9).font("Helvetica-Bold").fillColor("#374151");
        doc.text("Date", colX.date, tableTop);
        doc.text("Type", colX.type, tableTop);
        doc.text("Wallet", colX.wallet, tableTop);
        doc.text("Category", colX.category, tableTop);
        doc.text("Amount", colX.amount, tableTop, { width: 125, align: "right" });

        const headerBottom = tableTop + 15;
        drawDivider(headerBottom, "#9CA3AF");

        // 4. Transaction Rows
        let y = headerBottom + 10;
        doc.font("Helvetica").fontSize(9);

        if (transactions.length === 0) {
            doc.fillColor("#6B7280")
                .text("No transactions found for this period.", 40, y + 10, { align: "center", width: 515 });
        } else {
            transactions.forEach((tx) => {
                if (y > 730) {
                    doc.addPage();
                    y = 40;
                }

                const dateStr = tx.date instanceof Date
                    ? tx.date.toISOString().split("T")[0]
                    : String(tx.date).substring(0, 10);
                const typeStr = tx.type;
                const walletStr = tx.wallet?.name || "N/A";
                const categoryStr = tx.category?.name || "-";
                const amountStr = `${tx.currency || "IDR"} ${Number(tx.amount).toLocaleString()}`;
                const typeColor = typeStr === "INCOME" ? "#059669" : "#DC2626";

                doc.fillColor("#1F2937").text(dateStr, colX.date, y);
                doc.fillColor(typeColor).font("Helvetica-Bold").text(typeStr, colX.type, y);
                doc.font("Helvetica").fillColor("#1F2937");

                doc.text(walletStr, colX.wallet, y, { width: 110, height: 12, ellipsis: true });
                doc.text(categoryStr, colX.category, y, { width: 110, height: 12, ellipsis: true });
                doc.text(amountStr, colX.amount, y, { width: 125, align: "right" });

                y += 18;
                drawDivider(y - 4);
                y += 6;
            });
        }

        // 5. Footer
        const printDate = new Date().toISOString().replace("T", " ").substring(0, 16);
        doc.fontSize(8).fillColor("#9CA3AF").text(`Generated by FinPulse System on ${printDate} UTC`, 40, 780, { align: "left" });

        doc.end();
        return doc;
    }
}