import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Room } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      setAuth: (user, token) =>
        set({ user, token, isAuthenticated: true }),
      logout: () =>
        set({ user: null, token: null, isAuthenticated: false }),
    }),
    {
      name: 'auth-storage',
    }
  )
);

interface RoomState {
  currentRoom: Room | null;
  isHost: boolean;
  isSpeaker: boolean;
  isMuted: boolean;
  setCurrentRoom: (room: Room | null) => void;
  setIsHost: (isHost: boolean) => void;
  setIsSpeaker: (isSpeaker: boolean) => void;
  setIsMuted: (isMuted: boolean) => void;
  toggleMute: () => void;
  reset: () => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  currentRoom: null,
  isHost: false,
  isSpeaker: false,
  isMuted: true,
  setCurrentRoom: (room) => set({ currentRoom: room }),
  setIsHost: (isHost) => set({ isHost }),
  setIsSpeaker: (isSpeaker) => set({ isSpeaker }),
  setIsMuted: (isMuted) => set({ isMuted }),
  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  reset: () =>
    set({
      currentRoom: null,
      isHost: false,
      isSpeaker: false,
      isMuted: true,
    }),
}));
