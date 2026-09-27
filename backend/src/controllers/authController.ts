import { Request, Response } from 'express';
import { loginWithGoogleIdToken, createDemoSession } from '../services/authService.js';
import { AuthenticatedRequest } from '../middlewares/authMiddleware.js';

export async function googleLogin(req: Request, res: Response) {
  try {
    const { credential, idToken } = req.body;
    const tokenToVerify = credential || idToken;

    if (!tokenToVerify) {
      return res.status(400).json({ error: 'Missing credential or idToken in request' });
    }

    const { user, token } = await loginWithGoogleIdToken(tokenToVerify);
    return res.json({ success: true, user, token });
  } catch (error: any) {
    console.error('❌ Google login failed:', error.message);
    return res.status(401).json({ error: error.message || 'Google authentication failed' });
  }
}

export async function demoLogin(req: Request, res: Response) {
  try {
    const email = req.body.email || 'demo.user@reachinbox.ai';
    const name = req.body.name || 'Demo Engineer';
    const { user, token } = await createDemoSession(email, name);
    return res.json({ success: true, user, token });
  } catch (error: any) {
    console.error('❌ Demo login failed:', error.message);
    return res.status(500).json({ error: 'Failed to create demo session' });
  }
}

export async function getMe(req: AuthenticatedRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  return res.json({ user: req.user });
}
