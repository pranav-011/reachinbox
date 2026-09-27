import { Router } from 'express';
import {
  startSlackOAuth,
  slackOAuthCallback,
  getSlackStatus,
  configureManualWebhook,
  testSlackNotification,
  handleDisconnectSlack,
} from '../controllers/slackController.js';
import { optionalAuth } from '../middlewares/authMiddleware.js';

const router = Router();

router.get('/oauth/start', optionalAuth, startSlackOAuth);
router.get('/oauth/callback', optionalAuth, slackOAuthCallback);
router.get('/status', optionalAuth, getSlackStatus);
router.post('/webhook', optionalAuth, configureManualWebhook);
router.post('/test', optionalAuth, testSlackNotification);
router.post('/disconnect', optionalAuth, handleDisconnectSlack);

export default router;
