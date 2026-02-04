/**
 * McServer - Authentication Middleware
 * 
 * JWT-based authentication for the web dashboard.
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import fs from 'fs-extra';
import path from 'path';
import { User, AuthToken, Session } from '../types';
import { DEFAULT_DATA_DIR, JWT_EXPIRY, BCRYPT_ROUNDS, SESSION_EXPIRY } from '../constants';
import { createLogger, generateToken, generateId, atomicWrite } from '../utils';

const logger = createLogger('Auth');

// JWT Secret - generated on first run and stored
let jwtSecret: string;

interface UserStore {
  users: User[];
  sessions: Session[];
}

const store: UserStore = {
  users: [],
  sessions: []
};

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: User;
      session?: Session;
    }
  }
}

/**
 * Initialize authentication system
 */
export async function initializeAuth(): Promise<void> {
  const secretPath = path.join(DEFAULT_DATA_DIR, '.jwt_secret');
  const usersPath = path.join(DEFAULT_DATA_DIR, 'users.json');

  // Load or generate JWT secret
  if (await fs.pathExists(secretPath)) {
    jwtSecret = await fs.readFile(secretPath, 'utf-8');
  } else {
    jwtSecret = generateToken(64);
    await atomicWrite(secretPath, jwtSecret);
    await fs.chmod(secretPath, 0o600);
  }

  // Load users
  if (await fs.pathExists(usersPath)) {
    const data = await fs.readFile(usersPath, 'utf-8');
    const parsed = JSON.parse(data);
    store.users = parsed.users || [];
    store.sessions = (parsed.sessions || []).filter((s: Session) => 
      new Date(s.expiresAt) > new Date()
    );
  }

  // Create default admin user if none exist
  if (store.users.length === 0) {
    const password = generateToken(8);
    await createUser('admin', password, 'owner');
    logger.info(`Default admin user created. Password: ${password}`);
    logger.info('Please change this password after first login!');
  }

  logger.info('Authentication initialized');
}

/**
 * Save user store to disk
 */
async function saveStore(): Promise<void> {
  const usersPath = path.join(DEFAULT_DATA_DIR, 'users.json');
  await atomicWrite(usersPath, JSON.stringify(store, null, 2));
}

/**
 * Create a new user
 */
export async function createUser(
  username: string, 
  password: string, 
  role: User['role'] = 'member'
): Promise<User> {
  // Check for existing user
  if (store.users.find(u => u.username === username)) {
    throw new Error('Username already exists');
  }

  const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const user: User & { passwordHash: string } = {
    id: generateId(),
    username,
    role,
    createdAt: new Date(),
    lastLogin: null,
    passwordHash: hashedPassword
  };

  store.users.push(user as any);
  await saveStore();

  logger.info(`User created: ${username}`);

  // Return without password hash
  const { passwordHash, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

/**
 * Authenticate user and create session
 */
export async function authenticate(
  username: string, 
  password: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ user: User; token: string }> {
  const user = store.users.find(u => u.username === username) as (User & { passwordHash: string }) | undefined;
  
  if (!user) {
    throw new Error('Invalid credentials');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new Error('Invalid credentials');
  }

  // Update last login
  user.lastLogin = new Date();

  // Create session
  const session: Session = {
    id: generateId(),
    userId: user.id,
    token: generateToken(32),
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + SESSION_EXPIRY),
    ipAddress,
    userAgent
  };

  store.sessions.push(session);
  await saveStore();

  // Create JWT
  const token = jwt.sign(
    { 
      userId: user.id, 
      sessionId: session.id,
      role: user.role 
    },
    jwtSecret,
    { expiresIn: JWT_EXPIRY }
  );

  logger.info(`User logged in: ${username}`);

  const { passwordHash, ...userWithoutPassword } = user;
  return { user: userWithoutPassword, token };
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string): { userId: string; sessionId: string; role: string } | null {
  try {
    return jwt.verify(token, jwtSecret) as any;
  } catch {
    return null;
  }
}

/**
 * Get user by ID
 */
export function getUser(userId: string): User | undefined {
  const user = store.users.find(u => u.id === userId) as (User & { passwordHash?: string }) | undefined;
  if (user) {
    const { passwordHash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
  return undefined;
}

/**
 * Get all users
 */
export function getUsers(): User[] {
  return store.users.map(u => {
    const { passwordHash, ...userWithoutPassword } = u as any;
    return userWithoutPassword;
  });
}

/**
 * Delete user
 */
export async function deleteUser(userId: string): Promise<void> {
  const index = store.users.findIndex(u => u.id === userId);
  if (index === -1) {
    throw new Error('User not found');
  }

  // Don't delete last owner
  const user = store.users[index];
  if (user.role === 'owner') {
    const ownerCount = store.users.filter(u => u.role === 'owner').length;
    if (ownerCount <= 1) {
      throw new Error('Cannot delete the last owner');
    }
  }

  store.users.splice(index, 1);
  
  // Remove their sessions
  store.sessions = store.sessions.filter(s => s.userId !== userId);
  
  await saveStore();
  logger.info(`User deleted: ${userId}`);
}

/**
 * Change password
 */
export async function changePassword(userId: string, newPassword: string): Promise<void> {
  const user = store.users.find(u => u.id === userId) as (User & { passwordHash: string }) | undefined;
  if (!user) {
    throw new Error('User not found');
  }

  user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await saveStore();
  logger.info(`Password changed for user: ${userId}`);
}

/**
 * Invalidate session
 */
export async function logout(sessionId: string): Promise<void> {
  store.sessions = store.sessions.filter(s => s.id !== sessionId);
  await saveStore();
}

/**
 * Invalidate all sessions for a user
 */
export async function logoutAll(userId: string): Promise<void> {
  store.sessions = store.sessions.filter(s => s.userId !== userId);
  await saveStore();
}

// ============================================================================
// Express Middleware
// ============================================================================

/**
 * Authentication middleware
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ 
      success: false, 
      error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } 
    });
    return;
  }

  const token = authHeader.substring(7);
  const decoded = verifyToken(token);

  if (!decoded) {
    res.status(401).json({ 
      success: false, 
      error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' } 
    });
    return;
  }

  // Check session still exists
  const session = store.sessions.find(s => s.id === decoded.sessionId);
  if (!session || new Date(session.expiresAt) < new Date()) {
    res.status(401).json({ 
      success: false, 
      error: { code: 'SESSION_EXPIRED', message: 'Session expired' } 
    });
    return;
  }

  // Get user
  const user = getUser(decoded.userId);
  if (!user) {
    res.status(401).json({ 
      success: false, 
      error: { code: 'USER_NOT_FOUND', message: 'User not found' } 
    });
    return;
  }

  req.user = user;
  req.session = session;
  next();
}

/**
 * Role-based authorization middleware
 */
export function requireRole(...roles: User['role'][]): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ 
        success: false, 
        error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } 
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ 
        success: false, 
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } 
      });
      return;
    }

    next();
  };
}

/**
 * Optional authentication middleware (doesn't fail if not authenticated)
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    if (decoded) {
      const session = store.sessions.find(s => s.id === decoded.sessionId);
      if (session && new Date(session.expiresAt) > new Date()) {
        const user = getUser(decoded.userId);
        if (user) {
          req.user = user;
          req.session = session;
        }
      }
    }
  }

  next();
}
