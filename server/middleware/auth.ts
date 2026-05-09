import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET!;

export interface AuthPayload {
  userId: string;
  name: string;
}

export interface AdminPayload {
  isAdmin: true;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthPayload;
      admin?: AdminPayload;
    }
  }
}

export function requireUser(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as AuthPayload;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Token expired or invalid' });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as AdminPayload;
    if (!payload.isAdmin) throw new Error('Not admin');
    req.admin = payload;
    next();
  } catch {
    res.status(403).json({ error: 'Admin access required' });
  }
}

export function signUserToken(userId: string, name: string): string {
  return jwt.sign({ userId, name } satisfies AuthPayload, JWT_SECRET, { expiresIn: '7d' });
}

export function signAdminToken(): string {
  return jwt.sign({ isAdmin: true } satisfies AdminPayload, JWT_SECRET, { expiresIn: '12h' });
}
