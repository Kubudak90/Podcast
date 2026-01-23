import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, generateToken, AuthRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { registerSchema, loginSchema, updateProfileSchema } from '../lib/validation.js';
import { logAuth, logError } from '../lib/logger.js';

const router = Router();

// POST /api/auth/register
router.post('/register', authLimiter, validate(registerSchema), async (req: Request, res: Response) => {
  try {
    const { username, email } = req.body;

    // Check if username exists
    const existingUser = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUser) {
      return res.status(400).json({ message: 'Username already taken' });
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        username,
        email: email || null,
      },
    });

    const token = generateToken(user.id, user.username);

    logAuth('register', user.id, user.username, true);

    res.status(201).json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        createdAt: user.createdAt.toISOString(),
      },
      token,
    });
  } catch (error) {
    logError(error as Error, { action: 'register' });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/auth/login
router.post('/login', authLimiter, validate(loginSchema), async (req: Request, res: Response) => {
  try {
    const { username } = req.body;

    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const token = generateToken(user.id, user.username);

    logAuth('login', user.id, user.username, true);

    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        createdAt: user.createdAt.toISOString(),
      },
      token,
    });
  } catch (error) {
    logError(error as Error, { action: 'login' });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      createdAt: user.createdAt.toISOString(),
    });
  } catch (error) {
    logError(error as Error, { action: 'me', userId: req.userId });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PATCH /api/auth/profile - Update user profile
router.patch('/profile', authMiddleware, validate(updateProfileSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { username, email, bio, avatarUrl } = req.body;

    // Check if username is taken by another user
    if (username) {
      const existingUser = await prisma.user.findFirst({
        where: {
          username,
          NOT: { id: req.userId },
        },
      });

      if (existingUser) {
        return res.status(400).json({ message: 'Username already taken' });
      }
    }

    // Check if email is taken by another user
    if (email) {
      const existingEmail = await prisma.user.findFirst({
        where: {
          email,
          NOT: { id: req.userId },
        },
      });

      if (existingEmail) {
        return res.status(400).json({ message: 'Email already in use' });
      }
    }

    const updateData: Record<string, string | null> = {};
    if (username !== undefined) updateData.username = username;
    if (email !== undefined) updateData.email = email;
    if (bio !== undefined) updateData.bio = bio;
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: updateData,
    });

    logAuth('profile_update', user.id, user.username, true);

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      createdAt: user.createdAt.toISOString(),
    });
  } catch (error) {
    logError(error as Error, { action: 'profile_update', userId: req.userId });
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
