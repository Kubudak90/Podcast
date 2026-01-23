import { Router, Response } from 'express';
import { nanoid } from 'nanoid';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { roomCreateLimiter } from '../middleware/rateLimit.js';
import { createRoomSchema, changeRoleSchema, joinRoomSchema } from '../lib/validation.js';
import { startRoomRecording, stopRoomRecording } from '../lib/livekit.js';
import { emitParticipantJoined, emitParticipantLeft, emitRoomStatusChanged, emitParticipantRoleChanged } from '../lib/socket.js';
import { logRoom, logRecording, logError } from '../lib/logger.js';
import { notifyFollowersOfLive } from '../lib/push.js';

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// GET /api/rooms - List public rooms
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const offset = Number(req.query.offset) || 0;
    const search = req.query.search as string | undefined;
    const status = req.query.status as string | undefined; // 'live', 'waiting', or undefined for both

    // Build where clause
    const where: {
      isPublic: boolean;
      status: { in: string[] } | string;
      title?: { contains: string; mode: 'insensitive' };
    } = {
      isPublic: true,
      status: status && ['live', 'waiting'].includes(status)
        ? status
        : { in: ['live', 'waiting'] },
    };

    // Add search filter
    if (search && search.trim()) {
      where.title = {
        contains: search.trim(),
        mode: 'insensitive',
      };
    }

    const [rooms, totalCount] = await Promise.all([
      prisma.room.findMany({
        where,
        include: {
          host: {
            select: { id: true, username: true, avatarUrl: true },
          },
          _count: {
            select: { participants: true },
          },
        },
        orderBy: [
          { status: 'asc' }, // 'live' before 'waiting'
          { createdAt: 'desc' },
        ],
        take: limit,
        skip: offset,
      }),
      prisma.room.count({ where }),
    ]);

    // Get active participant count for each room
    const roomsWithActiveCount = await Promise.all(
      rooms.map(async (room: typeof rooms[number]) => {
        const activeParticipants = await prisma.roomParticipant.count({
          where: { roomId: room.id, leftAt: null },
        });

        return {
          id: room.id,
          slug: room.slug,
          title: room.title,
          status: room.status,
          isPublic: room.isPublic,
          hasPassword: !!room.password,
          host: room.host,
          participantCount: activeParticipants,
          maxSpeakers: room.maxSpeakers,
          createdAt: room.createdAt.toISOString(),
          startedAt: room.startedAt?.toISOString() || null,
        };
      })
    );

    res.json({
      rooms: roomsWithActiveCount,
      total: totalCount,
      limit,
      offset,
    });
  } catch (error) {
    logError(error as Error, { action: 'list_public_rooms' });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/rooms - Create room
router.post('/', roomCreateLimiter, validate(createRoomSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { title, isPublic = true, maxSpeakers = 10, password } = req.body;

    const slug = nanoid(8);

    const room = await prisma.room.create({
      data: {
        slug,
        title,
        hostId: req.userId!,
        isPublic,
        maxSpeakers,
        password: password || null,
      },
    });

    // Add host as participant
    await prisma.roomParticipant.create({
      data: {
        roomId: room.id,
        userId: req.userId!,
        role: 'host',
      },
    });

    res.status(201).json({
      id: room.id,
      slug: room.slug,
      title: room.title,
      hostId: room.hostId,
      status: room.status,
      maxSpeakers: room.maxSpeakers,
      isPublic: room.isPublic,
      hasPassword: !!room.password,
      createdAt: room.createdAt.toISOString(),
      startedAt: room.startedAt?.toISOString(),
      endedAt: room.endedAt?.toISOString(),
    });
  } catch (error) {
    logError(error as Error, { action: 'create_room', userId: req.userId });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/rooms/:slug - Get room details
router.get('/:slug', async (req: AuthRequest<{ slug: string }>, res: Response) => {
  try {
    const { slug } = req.params;

    const room = await prisma.room.findUnique({
      where: { slug },
    });

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    const host = await prisma.user.findUnique({
      where: { id: room.hostId },
      select: { id: true, username: true, avatarUrl: true },
    });

    const participants = await prisma.roomParticipant.findMany({
      where: { roomId: room.id, leftAt: null },
      include: {
        user: {
          select: { id: true, username: true, avatarUrl: true },
        },
      },
    });

    res.json({
      id: room.id,
      slug: room.slug,
      title: room.title,
      hostId: room.hostId,
      host,
      status: room.status,
      maxSpeakers: room.maxSpeakers,
      isPublic: room.isPublic,
      hasPassword: !!room.password,
      createdAt: room.createdAt.toISOString(),
      startedAt: room.startedAt?.toISOString(),
      endedAt: room.endedAt?.toISOString(),
      participants: participants.map((p: typeof participants[number]) => ({
        id: p.id,
        odaId: p.roomId,
        odaSlug: room.slug,
        userId: p.userId,
        username: p.user.username,
        avatarUrl: p.user.avatarUrl,
        role: p.role,
        joinedAt: p.joinedAt.toISOString(),
      })),
    });
  } catch (error) {
    logError(error as Error, { action: 'get_room' });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/rooms/:slug/join - Join room
router.post('/:slug/join', validate(joinRoomSchema), async (req: AuthRequest<{ slug: string }>, res: Response) => {
  try {
    const { slug } = req.params;
    const { password } = req.body;

    const room = await prisma.room.findUnique({
      where: { slug },
    });

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    if (room.status === 'ended') {
      return res.status(400).json({ message: 'Room has ended' });
    }

    // Check password for private rooms (skip if host)
    if (room.password && room.hostId !== req.userId) {
      if (!password || password !== room.password) {
        return res.status(403).json({ message: 'Invalid password', requiresPassword: true });
      }
    }

    // Check if already a participant
    const existingParticipant = await prisma.roomParticipant.findUnique({
      where: {
        roomId_userId: {
          roomId: room.id,
          userId: req.userId!,
        },
      },
    });

    if (existingParticipant && !existingParticipant.leftAt) {
      return res.json({
        room: {
          id: room.id,
          slug: room.slug,
          title: room.title,
          hostId: room.hostId,
          status: room.status,
          maxSpeakers: room.maxSpeakers,
          isPublic: room.isPublic,
          createdAt: room.createdAt.toISOString(),
          startedAt: room.startedAt?.toISOString(),
          endedAt: room.endedAt?.toISOString(),
        },
        participant: {
          role: existingParticipant.role,
        },
      });
    }

    // Count current speakers
    const speakerCount = await prisma.roomParticipant.count({
      where: {
        roomId: room.id,
        role: { in: ['host', 'speaker'] },
        leftAt: null,
      },
    });

    // Determine role
    const role = speakerCount < room.maxSpeakers ? 'speaker' : 'listener';

    // Create or update participant
    const participant = existingParticipant
      ? await prisma.roomParticipant.update({
          where: { id: existingParticipant.id },
          data: { leftAt: null, role },
        })
      : await prisma.roomParticipant.create({
          data: {
            roomId: room.id,
            userId: req.userId!,
            role,
          },
        });

    // Emit socket event for new participant
    emitParticipantJoined(room.slug, {
      userId: req.userId!,
      username: req.user!.username,
      role: participant.role,
      avatarUrl: req.user!.avatarUrl,
    });

    res.json({
      room: {
        id: room.id,
        slug: room.slug,
        title: room.title,
        hostId: room.hostId,
        status: room.status,
        maxSpeakers: room.maxSpeakers,
        isPublic: room.isPublic,
        createdAt: room.createdAt.toISOString(),
        startedAt: room.startedAt?.toISOString(),
        endedAt: room.endedAt?.toISOString(),
      },
      participant: {
        role: participant.role,
      },
    });
  } catch (error) {
    logError(error as Error, { action: 'join_room', userId: req.userId });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/rooms/:slug/leave - Leave room
router.post('/:slug/leave', async (req: AuthRequest<{ slug: string }>, res: Response) => {
  try {
    const { slug } = req.params;

    const room = await prisma.room.findUnique({
      where: { slug },
    });

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    await prisma.roomParticipant.updateMany({
      where: {
        roomId: room.id,
        userId: req.userId!,
        leftAt: null,
      },
      data: {
        leftAt: new Date(),
      },
    });

    // Emit socket event for participant leaving
    emitParticipantLeft(room.slug, req.userId!);

    res.json({ message: 'Left room successfully' });
  } catch (error) {
    logError(error as Error, { action: 'leave_room', userId: req.userId });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/rooms/:slug/start - Start room (host only)
router.post('/:slug/start', async (req: AuthRequest<{ slug: string }>, res: Response) => {
  try {
    const { slug } = req.params;

    const room = await prisma.room.findUnique({
      where: { slug },
    });

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    if (room.hostId !== req.userId) {
      return res.status(403).json({ message: 'Only the host can start the room' });
    }

    if (room.status !== 'waiting') {
      return res.status(400).json({ message: 'Room is not in waiting state' });
    }

    // Start recording via LiveKit Egress
    let egressId: string | null = null;
    try {
      const result = await startRoomRecording(room.slug);
      egressId = result.egressId;
      logRecording('start', room.slug, egressId);
    } catch (egressError) {
      logRecording('error', room.slug, undefined, (egressError as Error).message);
      // Continue without recording - don't block the room start
    }

    const updatedRoom = await prisma.room.update({
      where: { id: room.id },
      data: {
        status: 'live',
        startedAt: new Date(),
        egressId,
      },
    });

    // Emit socket event for room status change
    emitRoomStatusChanged(room.slug, 'live', !!egressId);

    // Notify followers that host is live (fire and forget)
    notifyFollowersOfLive(req.userId!, req.user!.username, room.title, room.slug).catch(() => {
      // Ignore notification errors
    });

    res.json({
      id: updatedRoom.id,
      slug: updatedRoom.slug,
      title: updatedRoom.title,
      hostId: updatedRoom.hostId,
      status: updatedRoom.status,
      maxSpeakers: updatedRoom.maxSpeakers,
      isPublic: updatedRoom.isPublic,
      isRecording: !!egressId,
      createdAt: updatedRoom.createdAt.toISOString(),
      startedAt: updatedRoom.startedAt?.toISOString(),
      endedAt: updatedRoom.endedAt?.toISOString(),
    });
  } catch (error) {
    logError(error as Error, { action: 'start_room', userId: req.userId });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/rooms/:slug/end - End room (host only)
router.post('/:slug/end', async (req: AuthRequest<{ slug: string }>, res: Response) => {
  try {
    const { slug } = req.params;

    const room = await prisma.room.findUnique({
      where: { slug },
    });

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    if (room.hostId !== req.userId) {
      return res.status(403).json({ message: 'Only the host can end the room' });
    }

    if (room.status === 'ended') {
      return res.status(400).json({ message: 'Room has already ended' });
    }

    // Stop recording if active
    if (room.egressId) {
      try {
        await stopRoomRecording(room.egressId);
        logRecording('stop', room.slug, room.egressId);

        // Calculate duration
        const durationSeconds = room.startedAt
          ? Math.floor((Date.now() - room.startedAt.getTime()) / 1000)
          : null;

        // Create recording entry
        await prisma.recording.create({
          data: {
            roomId: room.id,
            fileUrl: `recordings/${room.slug}-${room.startedAt?.getTime()}.mp3`,
            durationSeconds,
            format: 'mp3',
          },
        });
      } catch (egressError) {
        logRecording('error', room.slug, room.egressId, (egressError as Error).message);
        // Continue ending the room even if recording stop fails
      }
    }

    // End room and mark all participants as left
    const [updatedRoom] = await prisma.$transaction([
      prisma.room.update({
        where: { id: room.id },
        data: {
          status: 'ended',
          endedAt: new Date(),
          egressId: null, // Clear egress ID
        },
      }),
      prisma.roomParticipant.updateMany({
        where: {
          roomId: room.id,
          leftAt: null,
        },
        data: {
          leftAt: new Date(),
        },
      }),
    ]);

    // Emit socket event for room ended
    emitRoomStatusChanged(room.slug, 'ended');

    res.json({
      id: updatedRoom.id,
      slug: updatedRoom.slug,
      title: updatedRoom.title,
      hostId: updatedRoom.hostId,
      status: updatedRoom.status,
      maxSpeakers: updatedRoom.maxSpeakers,
      isPublic: updatedRoom.isPublic,
      createdAt: updatedRoom.createdAt.toISOString(),
      startedAt: updatedRoom.startedAt?.toISOString(),
      endedAt: updatedRoom.endedAt?.toISOString(),
    });
  } catch (error) {
    logError(error as Error, { action: 'end_room', userId: req.userId });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PATCH /api/rooms/:slug/role - Change role
router.patch('/:slug/role', validate(changeRoleSchema), async (req: AuthRequest<{ slug: string }>, res: Response) => {
  try {
    const { slug } = req.params;
    const { userId, role } = req.body;

    const room = await prisma.room.findUnique({
      where: { slug },
    });

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    if (room.hostId !== req.userId) {
      return res.status(403).json({ message: 'Only the host can change roles' });
    }

    await prisma.roomParticipant.updateMany({
      where: {
        roomId: room.id,
        userId,
        leftAt: null,
      },
      data: { role },
    });

    // Emit socket event for role change
    emitParticipantRoleChanged(room.slug, userId, role);

    res.json({ message: 'Role updated successfully' });
  } catch (error) {
    logError(error as Error, { action: 'change_role', userId: req.userId });
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
