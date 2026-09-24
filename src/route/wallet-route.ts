import {Router} from "express";
import {authenticate} from "../middleware/authenticate.js";
import {createWalletSchema, updateWalletSchema, walletIdParamSchema} from "../validation/wallet-validation.js";
import { validate } from '../middleware/validate.js';
import {WalletController} from "../controller/wallet-controller.js";

const router = Router();

//Protect all wallet routes with authentication
router.use(authenticate);

router.post('/', validate(createWalletSchema), WalletController.createWallet);
router.get('/', WalletController.getWallets);
router.get('/:id', validate(walletIdParamSchema), WalletController.getWalletById);
router.patch('/:id', validate(updateWalletSchema), WalletController.updateWallet);
router.delete('/:id', validate(walletIdParamSchema), WalletController.deleteWallet);

export default router;