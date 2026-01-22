import { Router, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { getPresignedDownloadUrl } from '../lib/storage.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

// GET /api/rooms/:slug/recordings - Get recordings for a room
router.get('/rooms/:slug/recordings', async (req: AuthRequest, res: Response) => {
  try {
    const { slug } = req.params;

    const room = await prisma.room.findUnique({
      where: { slug },
      include: {
        recordings: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    res.json(
      room.recordings.map((r) => ({
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
router.get('/:id/download', async (req: AuthRequest, res: Response) => {
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
    console.error('Get download URL error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
