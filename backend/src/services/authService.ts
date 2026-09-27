import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/prisma.js';
import { config } from '../config/index.js';

const googleClient = new OAuth2Client(config.google.clientId);

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
}

export function generateToken(user: AuthUser): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
    },
    config.jwtSecret,
    { expiresIn: '7d' }
  );
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as any;
    return {
      id: decoded.id,
      email: decoded.email,
      name: decoded.name,
      avatar: decoded.avatar,
    };
  } catch {
    return null;
  }
}

export async function loginWithGoogleIdToken(idToken: string): Promise<{ user: AuthUser; token: string }> {
  let email: string;
  let name: string | undefined;
  let avatar: string | undefined;
  let googleId: string;

  if (config.google.clientId) {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: config.google.clientId,
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      throw new Error('Invalid Google token: email not found in payload');
    }
    email = payload.email;
    name = payload.name;
    avatar = payload.picture;
    googleId = payload.sub;
  } else {
    // If no client ID configured yet, decode base64 JWT payload safely for dev/test
    try {
      const parts = idToken.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
        email = payload.email || 'demo@reachinbox.ai';
        name = payload.name || 'Demo User';
        avatar = payload.picture || 'https://lh3.googleusercontent.com/a/default-user';
        googleId = payload.sub || 'demo-google-sub-123';
      } else {
        throw new Error('Malformed token format');
      }
    } catch {
      email = 'demo@reachinbox.ai';
      name = 'Demo User';
      avatar = 'https://lh3.googleusercontent.com/a/default-user';
      googleId = 'demo-google-sub-123';
    }
  }

  // Upsert user in database
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name: name || undefined,
      avatar: avatar || undefined,
      googleId,
    },
    create: {
      email,
      name: name || null,
      avatar: avatar || null,
      googleId,
    },
  });

  const authUser: AuthUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    avatar: user.avatar,
  };

  const token = generateToken(authUser);

  return { user: authUser, token };
}

export async function createDemoSession(email = 'testuser@reachinbox.ai', name = 'Demo User'): Promise<{ user: AuthUser; token: string }> {
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name,
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
      googleId: `demo-${Date.now()}`,
    },
  });

  const authUser: AuthUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    avatar: user.avatar,
  };

  const token = generateToken(authUser);
  return { user: authUser, token };
}
