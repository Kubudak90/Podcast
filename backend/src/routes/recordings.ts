import { Router, Response, Request } from 'express';
import { nanoid } from 'nanoid';
import { prisma } from '../lib/prisma.js';
import { getPresignedDownloadUrl } from '../lib/storage.js';
import { authMiddleware, AuthRequest, optionalAuthMiddleware } from '../middleware/auth.js';
import { logError } from '../lib/logger.js';

const router = Router();

// GET /api/rooms/:slug/recordings - Get recordings for a room
router.get('/rooms/:slug/recordings', authMiddleware, async (req: AuthRequest<{ slug: string }>, res: Response) => {
  try {
    const { slug } = req.params;

    const room = await prisma.room.findUnique({
      where: { slug },
    });

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    const recordings = await prisma.recording.findMany({
      where: { roomId: room.id },
      orderBy: { createdAt: 'desc' },
    });

    res.json(
      recordings.map((r: typeof recordings[number]) => ({
        id: r.id,
        roomId: r.roomId,
        fileUrl: r.fileUrl,
        durationSeconds: r.durationSeconds || 0,
        fileSizeBytes: Number(r.fileSizeBytes) || 0,
        format: r.format,
        createdAt: r.createdAt.toISOString(),
      }))
    );
  } catch (error) {
    console.error('Get recordings error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/recordings/:id/download - Get download URL for a recording
router.get('/:id/download', authMiddleware, async (req: AuthRequest<{ id: string }>, res: Response) => {
  try {
    const { id } = req.params;

    const recording = await prisma.recording.findUnique({
      where: { id },
    });

    if (!recording) {
      return res.status(404).json({ message: 'Recording not found' });
    }

    // Extract the key from the file URL
    const url = new URL(recording.fileUrl);
    const key = url.pathname.slice(1); // Remove leading slash

    const presignedUrl = await getPresignedDownloadUrl(key);

    res.json({ url: presignedUrl });
  } catch (error) {
    logError(error as Error, { action: 'get_download_url' });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PATCH /api/recordings/:id - Update recording (owner only)
router.patch('/:id', authMiddleware, async (req: AuthRequest<{ id: string }>, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description, isPublic } = req.body;

    const recording = await prisma.recording.findUnique({
      where: { id },
      include: {
        room: {
          select: { hostId: true },
        },
      },
    });

    if (!recording) {
      return res.status(404).json({ message: 'Recording not found' });
    }

    // Only room host can update recording
    if (recording.room.hostId !== req.userId) {
      return res.status(403).json({ message: 'Only the room host can update recordings' });
    }

    // Generate share slug if making public and no slug exists
    let shareSlug = recording.shareSlug;
    if (isPublic && !shareSlug) {
      shareSlug = nanoid(10);
    }

    const updatedRecording = await prisma.recording.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(isPublic !== undefined && { isPublic }),
        ...(shareSlug && { shareSlug }),
      },
    });

    res.json({
      id: updatedRecording.id,
      title: updatedRecording.title,
      description: updatedRecording.description,
      isPublic: updatedRecording.isPublic,
      shareSlug: updatedRecording.shareSlug,
      durationSeconds: updatedRecording.durationSeconds,
      createdAt: updatedRecording.createdAt.toISOString(),
    });
  } catch (error) {
    logError(error as Error, { action: 'update_recording' });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/recordings/public/:shareSlug - Get public recording by share slug
router.get('/public/:shareSlug', optionalAuthMiddleware, async (req: AuthRequest<{ shareSlug: string }>, res: Response) => {
  try {
    const { shareSlug } = req.params;

    const recording = await prisma.recording.findUnique({
      where: { shareSlug },
      include: {
        room: {
          select: {
            id: true,
            slug: true,
            title: true,
            host: {
              select: { id: true, username: true, avatarUrl: true },
            },
          },
        },
      },
    });

    if (!recording || !recording.isPublic) {
      return res.status(404).json({ message: 'Recording not found' });
    }

    // Increment play count
    await prisma.recording.update({
      where: { id: recording.id },
      data: { playCount: { increment: 1 } },
    });

    res.json({
      id: recording.id,
      title: recording.title || recording.room.title,
      description: recording.description,
      durationSeconds: recording.durationSeconds,
      playCount: recording.playCount + 1,
      createdAt: recording.createdAt.toISOString(),
      room: {
        id: recording.room.id,
        slug: recording.room.slug,
        title: recording.room.title,
      },
      host: recording.room.host,
    });
  } catch (error) {
    logError(error as Error, { action: 'get_public_recording' });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/recordings/public/:shareSlug/download - Download public recording
router.get('/public/:shareSlug/download', optionalAuthMiddleware, async (req: AuthRequest<{ shareSlug: string }>, res: Response) => {
  try {
    const { shareSlug } = req.params;

    const recording = await prisma.recording.findUnique({
      where: { shareSlug },
    });

    if (!recording || !recording.isPublic) {
      return res.status(404).json({ message: 'Recording not found' });
    }

    // Extract the key from the file URL
    const url = new URL(recording.fileUrl);
    const key = url.pathname.slice(1); // Remove leading slash

    const presignedUrl = await getPresignedDownloadUrl(key);

    res.json({ url: presignedUrl });
  } catch (error) {
    logError(error as Error, { action: 'get_public_download_url' });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/recordings/feed - Get public recordings feed
router.get('/feed', optionalAuthMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const offset = Number(req.query.offset) || 0;

    const [recordings, total] = await Promise.all([
      prisma.recording.findMany({
        where: { isPublic: true },
        include: {
          room: {
            select: {
              id: true,
              slug: true,
              title: true,
              host: {
                select: { id: true, username: true, avatarUrl: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.recording.count({ where: { isPublic: true } }),
    ]);

    res.json({
      recordings: recordings.map((r) => ({
        id: r.id,
        title: r.title || r.room.title,
        description: r.description,
        shareSlug: r.shareSlug,
        durationSeconds: r.durationSeconds,
        playCount: r.playCount,
        createdAt: r.createdAt.toISOString(),
        room: {
          id: r.room.id,
          slug: r.room.slug,
          title: r.room.title,
        },
        host: r.room.host,
      })),
      total,
      limit,
      offset,
    });
  } catch (error) {
    logError(error as Error, { action: 'get_feed' });
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
