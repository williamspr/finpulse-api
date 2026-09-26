import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import {
    createTransactionSchema,
    getTransactionByIdParamsSchema,
    getTransactionsQuerySchema, updateTransactionSchema
} from "../validation/transaction-validation.js";
import { TransactionController } from "../controller/transaction-controller.js";

const router = Router();

router.use(authenticate);

router.post("/", validate(createTransactionSchema), TransactionController.createTransaction);
router.get("/", validate(getTransactionsQuerySchema), TransactionController.getTransactions);
router.get("/:id", validate(getTransactionByIdParamsSchema), TransactionController.getTransactionById);
router.patch("/:id", validate(updateTransactionSchema), TransactionController.updateTransaction);
router.delete("/:id", validate(getTransactionByIdParamsSchema), TransactionController.deleteTransaction);

export default router;