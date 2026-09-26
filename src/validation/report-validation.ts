import { z } from "zod";

enum ExportFormat {
    PDF = "pdf",
    CSV = "csv",
}

export const getReportSummaryQuerySchema = z.object({
    query: z.object({
        startDate: z.iso.datetime("Start date must be a valid ISO 8601 string (e.g. 2026-01-01T00:00:00.000Z)"),
        endDate: z.iso.datetime("End date must be a valid ISO 8601 string (e.g. 2026-01-31T23:59:59.999Z)")
    }).refine((data) => new Date(data.startDate) <= new Date(data.endDate), {
        message: "Start date must be less than or equal to End date",
        path: ["startDate"]
    })
});

export const exportReportQuerySchema = z.object({
    query: z.object({
        format: z.nativeEnum(ExportFormat, {
            message: "Format query parameter is required ('pdf' or 'csv')"
        }),
        startDate: z.iso.datetime("Start date must be a valid ISO 8601 string"),
        endDate: z.iso.datetime("End date must be a valid ISO 8601 string")
    }).refine((data) => new Date(data.startDate) <= new Date(data.endDate), {
        message: "Start date must be less than or equal to End date",
        path: ["startDate"]
    })
});

export type GetReportSummaryQueryInput = z.infer<typeof getReportSummaryQuerySchema>["query"];
export type ExportReportQueryInput = z.infer<typeof exportReportQuerySchema>["query"];