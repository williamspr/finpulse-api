import { Router } from "express";
import {authenticate} from "../middleware/authenticate.js";
import { validate } from '../middleware/validate.js';
import {categoryIdParamSchema, createCategorySchema, getCategoriesQuerySchema} from "../validation/category-validation.js";
import { CategoryController } from "../controller/category-controller.js";

const router = Router();

router.use(authenticate);

router.post("/", validate(createCategorySchema), CategoryController.createCategory);
router.get("/", validate(getCategoriesQuerySchema), CategoryController.getCategories);
router.delete("/:id", validate(categoryIdParamSchema), CategoryController.deleteCategory);

export default router;