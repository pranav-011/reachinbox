import { Router } from 'express';
import { googleLogin, demoLogin, getMe } from '../controllers/authController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';

const router = Router();

router.post('/google', googleLogin);
router.post('/demo', demoLogin);
router.get('/me', requireAuth, getMe);

export default router;
