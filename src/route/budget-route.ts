import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import {createBudgetSchema, getBudgetStatusQuerySchema} from "../validation/budget-validation.js";
import { BudgetController } from "../controller/budget-controller.js";

const router = Router();

router.use(authenticate);

router.post("/", validate(createBudgetSchema), BudgetController.createBudget);
router.get("/status", validate(getBudgetStatusQuerySchema), BudgetController.getBudgetStatus);

export default router;