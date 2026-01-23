import { Router, Response } from 'express';
import { nanoid } from 'nanoid';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { roomCreateLimiter } from '../middleware/rateLimit.js';
import { createRoomSchema, changeRoleSchema } from '../lib/validation.js';
import { startRoomRecording, stopRoomRecording } from '../lib/livekit.js';

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// POST /api/rooms - Create room
router.post('/', roomCreateLimiter, validate(createRoomSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { title, isPublic = true, maxSpeakers = 10 } = req.body;

    const slug = nanoid(8);

    const room = await prisma.room.create({
      data: {
        slug,
        title,
        hostId: req.userId!,
        isPublic,
        maxSpeakers,
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
      createdAt: room.createdAt.toISOString(),
      startedAt: room.startedAt?.toISOString(),
      endedAt: room.endedAt?.toISOString(),
    });
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/rooms/:slug - Get room details
router.get('/:slug', async (req: AuthRequest, res: Response) => {
  try {
    const { slug } = req.params;

    const room = await prisma.room.findUnique({
      where: { slug },
      include: {
        host: {
          select: { id: true, username: true, avatarUrl: true },
        },
        participants: {
          where: { leftAt: null },
          include: {
            user: {
              select: { id: true, username: true, avatarUrl: true },
            },
          },
        },
      },
    });

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    res.json({
      id: room.id,
      slug: room.slug,
      title: room.title,
      hostId: room.hostId,
      host: room.host,
      status: room.status,
      maxSpeakers: room.maxSpeakers,
      isPublic: room.isPublic,
      createdAt: room.createdAt.toISOString(),
      startedAt: room.startedAt?.toISOString(),
      endedAt: room.endedAt?.toISOString(),
      participants: room.participants.map((p) => ({
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
    console.error('Get room error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/rooms/:slug/join - Join room
router.post('/:slug/join', async (req: AuthRequest, res: Response) => {
  try {
    const { slug } = req.params;

    const room = await prisma.room.findUnique({
      where: { slug },
    });

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    if (room.status === 'ended') {
      return res.status(400).json({ message: 'Room has ended' });
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
    console.error('Join room error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/rooms/:slug/leave - Leave room
router.post('/:slug/leave', async (req: AuthRequest, res: Response) => {
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

    res.json({ message: 'Left room successfully' });
  } catch (error) {
    console.error('Leave room error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/rooms/:slug/start - Start room (host only)
router.post('/:slug/start', async (req: AuthRequest, res: Response) => {
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
      console.log(`Recording started for room ${room.slug}, egressId: ${egressId}`);
    } catch (egressError) {
      console.error('Failed to start recording:', egressError);
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
    console.error('Start room error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/rooms/:slug/end - End room (host only)
router.post('/:slug/end', async (req: AuthRequest, res: Response) => {
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
        console.log(`Recording stopped for room ${room.slug}, egressId: ${room.egressId}`);

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
        console.error('Failed to stop recording:', egressError);
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
    console.error('End room error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PATCH /api/rooms/:slug/role - Change role
router.patch('/:slug/role', validate(changeRoleSchema), async (req: AuthRequest, res: Response) => {
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

    res.json({ message: 'Role updated successfully' });
  } catch (error) {
    console.error('Change role error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
