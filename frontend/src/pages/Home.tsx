import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Modal } from '../components/UI';
import { api } from '../lib/api';
import { useAuthStore, useRoomStore } from '../lib/store';

export function Home() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const { setCurrentRoom, setIsHost } = useRoomStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [roomTitle, setRoomTitle] = useState('');
  const [roomSlug, setRoomSlug] = useState('');
  const [roomPassword, setRoomPassword] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Mikrofon izni kontrolu ve istegi
  const requestMicPermission = useCallback(async (): Promise<boolean> => {
    try {
      // Mevcut izin durumunu kontrol et
      if (navigator.permissions) {
        const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });

        if (result.state === 'granted') {
          return true;
        }
      }

      // Mikrofon erisimi iste
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stream'i kapat (sadece izin almak icin kullandik)
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (err) {
      console.error('Mikrofon izni alinamadi:', err);
      setError('Mikrofon izni gerekli. Lutfen tarayici ayarlarindan mikrofon iznini verin.');
      return false;
    }
  }, []);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomTitle.trim()) return;

    setIsLoading(true);
    setError('');

    try {
      // Oncelikle mikrofon izni al
      const hasPermission = await requestMicPermission();
      if (!hasPermission) {
        setIsLoading(false);
        return;
      }

      const room = await api.createRoom(roomTitle.trim(), !isPrivate, isPrivate ? roomPassword : undefined);
      setCurrentRoom(room);
      setIsHost(true);
      navigate(`/room/${room.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Oda olusturulamadi');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomSlug.trim()) return;

    setIsLoading(true);
    setError('');

    try {
      // Oncelikle mikrofon izni al
      const hasPermission = await requestMicPermission();
      if (!hasPermission) {
        setIsLoading(false);
        return;
      }

      const slug = roomSlug.trim().replace(/.*\/room\//, '');
      const { room, participant } = await api.joinRoom(slug, joinPassword || undefined);
      setCurrentRoom(room);
      setIsHost(participant.role === 'host');
      navigate(`/room/${slug}`);
    } catch (err: unknown) {
      const error = err as { message?: string; requiresPassword?: boolean };
      if (error.requiresPassword) {
        setRequiresPassword(true);
        setError('Bu oda sifre ile korunuyor');
      } else {
        setError(error.message || 'Odaya katilamadi');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = (action: 'create' | 'join') => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (action === 'create') {
      setShowCreateModal(true);
    } else {
      setShowJoinModal(true);
    }
  };

  return (
    <div className="min-h-screen-safe flex flex-col items-center justify-center p-4 safe-area-pb">
      <div className="text-center mb-12">
        <h1 className="text-4xl sm:text-5xl font-bold mb-4">
          Arkadaslarinla{' '}
          <span className="text-primary-500">Canli Podcast</span>
        </h1>
        <p className="text-slate-400 text-lg max-w-md mx-auto">
          Oda olustur, arkadaslarini davet et ve birlikte podcast kaydet.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
        <Button
          size="lg"
          className="flex-1"
          onClick={() => handleAction('create')}
        >
          <svg
            className="w-5 h-5 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          Oda Olustur
        </Button>
        <Button
          size="lg"
          variant="secondary"
          className="flex-1"
          onClick={() => handleAction('join')}
        >
          <svg
            className="w-5 h-5 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 16l-4-4m0 0l4-4m-4 4h14"
            />
          </svg>
          Odaya Katil
        </Button>
      </div>

      {/* Create Room Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setRoomTitle('');
          setRoomPassword('');
          setIsPrivate(false);
          setError('');
        }}
        title="Yeni Oda Olustur"
      >
        <form onSubmit={handleCreateRoom} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Oda Basligi
            </label>
            <input
              type="text"
              value={roomTitle}
              onChange={(e) => setRoomTitle(e.target.value)}
              placeholder="ornegin: Haftalik Sohbet"
              className="input"
              autoFocus
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isPrivate"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="isPrivate" className="text-sm">
              Ozel oda (sifre ile korunan)
            </label>
          </div>

          {isPrivate && (
            <div>
              <label className="block text-sm font-medium mb-2">
                Oda Sifresi
              </label>
              <input
                type="password"
                value={roomPassword}
                onChange={(e) => setRoomPassword(e.target.value)}
                placeholder="En az 4 karakter"
                className="input"
                minLength={4}
                required={isPrivate}
              />
            </div>
          )}

          {error && <p className="text-red-400 text-sm">{error}</p>}
          <Button type="submit" className="w-full" isLoading={isLoading}>
            Olustur
          </Button>
        </form>
      </Modal>

      {/* Join Room Modal */}
      <Modal
        isOpen={showJoinModal}
        onClose={() => {
          setShowJoinModal(false);
          setRoomSlug('');
          setJoinPassword('');
          setRequiresPassword(false);
          setError('');
        }}
        title="Odaya Katil"
      >
        <form onSubmit={handleJoinRoom} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Oda Linki veya Kodu
            </label>
            <input
              type="text"
              value={roomSlug}
              onChange={(e) => setRoomSlug(e.target.value)}
              placeholder="ornegin: abc123 veya podchat.app/room/abc123"
              className="input"
              autoFocus
            />
          </div>

          {requiresPassword && (
            <div>
              <label className="block text-sm font-medium mb-2">
                Oda Sifresi
              </label>
              <input
                type="password"
                value={joinPassword}
                onChange={(e) => setJoinPassword(e.target.value)}
                placeholder="Sifre girin"
                className="input"
                required
              />
            </div>
          )}

          {error && <p className="text-red-400 text-sm">{error}</p>}
          <Button type="submit" className="w-full" isLoading={isLoading}>
            Katil
          </Button>
        </form>
      </Modal>
    </div>
  );
}
