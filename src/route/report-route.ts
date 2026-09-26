import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import {exportReportQuerySchema, getReportSummaryQuerySchema} from "../validation/report-validation.js";
import { ReportController } from "../controller/report-controller.js";

const router = Router();

router.use(authenticate);

router.get("/summary", validate(getReportSummaryQuerySchema), ReportController.getSummary);
router.get("/export", validate(exportReportQuerySchema), ReportController.exportReport);

export default router;