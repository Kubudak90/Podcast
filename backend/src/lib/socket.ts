import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { logger } from './logger.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  username?: string;
}

let io: Server | null = null;

export function initializeSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      credentials: true,
    },
  });

  // Authentication middleware
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; username: string };
      socket.userId = decoded.userId;
      socket.username = decoded.username;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    logger.debug({ userId: socket.userId, username: socket.username }, 'User connected via socket');

    // Join a room channel
    socket.on('room:join', (roomSlug: string) => {
      socket.join(`room:${roomSlug}`);
      logger.debug({ username: socket.username, roomSlug }, 'User joined room channel');
    });

    // Leave a room channel
    socket.on('room:leave', (roomSlug: string) => {
      socket.leave(`room:${roomSlug}`);
      logger.debug({ username: socket.username, roomSlug }, 'User left room channel');
    });

    socket.on('disconnect', () => {
      logger.debug({ username: socket.username }, 'User disconnected from socket');
    });
  });

  return io;
}

export function getIO(): Server {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
}

// Event emitters for room updates
export function emitRoomUpdate(roomSlug: string, data: {
  type: 'status_changed' | 'participant_joined' | 'participant_left' | 'participant_role_changed' | 'recording_started' | 'recording_stopped';
  payload: Record<string, unknown>;
}) {
  if (!io) return;
  io.to(`room:${roomSlug}`).emit('room:update', data);
}

export function emitParticipantJoined(roomSlug: string, participant: {
  userId: string;
  username: string;
  role: string;
  avatarUrl?: string | null;
}) {
  emitRoomUpdate(roomSlug, {
    type: 'participant_joined',
    payload: participant,
  });
}

export function emitParticipantLeft(roomSlug: string, userId: string) {
  emitRoomUpdate(roomSlug, {
    type: 'participant_left',
    payload: { userId },
  });
}

export function emitRoomStatusChanged(roomSlug: string, status: string, isRecording?: boolean) {
  emitRoomUpdate(roomSlug, {
    type: 'status_changed',
    payload: { status, isRecording },
  });
}

export function emitParticipantRoleChanged(roomSlug: string, userId: string, role: string) {
  emitRoomUpdate(roomSlug, {
    type: 'participant_role_changed',
    payload: { userId, role },
  });
}
