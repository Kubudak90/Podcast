import { z } from 'zod';

// Auth schemas
export const registerSchema = z.object({
  username: z
    .string()
    .min(2, 'Username must be at least 2 characters')
    .max(50, 'Username must be at most 50 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  email: z.string().email('Invalid email').optional(),
});

export const loginSchema = z.object({
  username: z
    .string()
    .min(2, 'Username must be at least 2 characters')
    .max(50, 'Username must be at most 50 characters'),
});

// Room schemas
export const createRoomSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(100, 'Title must be at most 100 characters'),
  isPublic: z.boolean().optional().default(true),
  maxSpeakers: z.number().min(1).max(10).optional().default(10),
  password: z.string().min(4, 'Password must be at least 4 characters').max(50).optional(),
});

export const joinRoomSchema = z.object({
  password: z.string().optional(),
});

export const changeRoleSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  role: z.enum(['speaker', 'listener'], {
    message: 'Role must be speaker or listener',
  }),
});

// LiveKit schemas
export const getLiveKitTokenSchema = z.object({
  roomSlug: z.string().min(1, 'Room slug is required'),
});

// Profile schema
export const updateProfileSchema = z.object({
  username: z
    .string()
    .min(2, 'Username must be at least 2 characters')
    .max(50, 'Username must be at most 50 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
    .optional(),
  email: z.string().email('Invalid email').optional().nullable(),
  bio: z.string().max(200, 'Bio must be at most 200 characters').optional().nullable(),
  avatarUrl: z.string().url('Invalid URL').optional().nullable(),
});

// Type exports
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type ChangeRoleInput = z.infer<typeof changeRoleSchema>;
export type GetLiveKitTokenInput = z.infer<typeof getLiveKitTokenSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
