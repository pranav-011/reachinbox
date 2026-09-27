import { Router } from 'express';
import {
  scheduleEmails,
  getScheduledEmails,
  getSentEmails,
  searchEmails,
  cancelEmail,
  getDashboardStats,
} from '../controllers/emailController.js';
import { optionalAuth } from '../middlewares/authMiddleware.js';

const router = Router();

router.use(optionalAuth);

router.post('/schedule', scheduleEmails);
router.get('/scheduled', getScheduledEmails);
router.get('/sent', getSentEmails);
router.get('/search', searchEmails);
router.delete('/:id', cancelEmail);
router.get('/stats', getDashboardStats);

export default router;
