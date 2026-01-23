import { useState, useCallback, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button, Modal, Avatar } from '../components/UI';
import { api } from '../lib/api';
import { useAuthStore, useRoomStore } from '../lib/store';
import type { PublicRoom } from '../types';

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

  // Public rooms state
  const [publicRooms, setPublicRooms] = useState<PublicRoom[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'live' | 'waiting'>('all');

  // Fetch public rooms
  const fetchPublicRooms = useCallback(async () => {
    if (!isAuthenticated) return;

    setIsLoadingRooms(true);
    try {
      const response = await api.getPublicRooms({
        limit: 20,
        search: searchQuery || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });
      setPublicRooms(response.rooms);
    } catch (err) {
      console.error('Failed to fetch public rooms:', err);
    } finally {
      setIsLoadingRooms(false);
    }
  }, [isAuthenticated, searchQuery, statusFilter]);

  // Fetch rooms on mount and when filters change
  useEffect(() => {
    fetchPublicRooms();
  }, [fetchPublicRooms]);

  // Refresh rooms periodically (every 30 seconds)
  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(fetchPublicRooms, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated, fetchPublicRooms]);

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

  const handleJoinPublicRoom = async (room: PublicRoom) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (room.hasPassword) {
      setRoomSlug(room.slug);
      setRequiresPassword(true);
      setShowJoinModal(true);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const hasPermission = await requestMicPermission();
      if (!hasPermission) {
        setIsLoading(false);
        return;
      }

      const { room: joinedRoom, participant } = await api.joinRoom(room.slug);
      setCurrentRoom(joinedRoom);
      setIsHost(participant.role === 'host');
      navigate(`/room/${room.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Odaya katilamadi');
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

  // Live and waiting room counts
  const liveRooms = publicRooms.filter(r => r.status === 'live');
  const waitingRooms = publicRooms.filter(r => r.status === 'waiting');

  return (
    <div className="min-h-screen-safe p-4 safe-area-pb">
      {/* Hero Section */}
      <div className="text-center py-8 sm:py-12">
        <h1 className="text-3xl sm:text-5xl font-bold mb-4">
          Arkadaslarinla{' '}
          <span className="text-primary-500">Canli Podcast</span>
        </h1>
        <p className="text-slate-400 text-lg max-w-md mx-auto mb-8">
          Oda olustur, arkadaslarini davet et ve birlikte podcast kaydet.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md mx-auto">
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
      </div>

      {/* Public Rooms Section */}
      {isAuthenticated && (
        <div className="max-w-4xl mx-auto mt-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <svg className="w-6 h-6 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              Acik Odalar
              {publicRooms.length > 0 && (
                <span className="text-sm text-slate-400 font-normal">
                  ({liveRooms.length} canli, {waitingRooms.length} bekliyor)
                </span>
              )}
            </h2>

            {/* Search and Filters */}
            <div className="flex gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-initial">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Oda ara..."
                  className="input pl-9 w-full sm:w-48"
                />
                <svg
                  className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'live' | 'waiting')}
                className="input w-auto"
              >
                <option value="all">Tumu</option>
                <option value="live">Canli</option>
                <option value="waiting">Bekliyor</option>
              </select>
            </div>
          </div>

          {isLoadingRooms ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
            </div>
          ) : publicRooms.length === 0 ? (
            <div className="card text-center py-12">
              <svg className="w-16 h-16 mx-auto mb-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              <p className="text-slate-400 mb-4">
                {searchQuery ? 'Aramanizla eslesen oda bulunamadi' : 'Henuz acik oda yok'}
              </p>
              <Button onClick={() => handleAction('create')}>
                Ilk Odayi Sen Olustur
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {publicRooms.map((room) => (
                <div
                  key={room.id}
                  className="card hover:bg-slate-800/80 transition-colors cursor-pointer group"
                  onClick={() => handleJoinPublicRoom(room)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate group-hover:text-primary-400 transition-colors">
                        {room.title}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Avatar name={room.host.username} src={room.host.avatarUrl} size="sm" />
                        <span className="text-sm text-slate-400 truncate">
                          {room.host.username}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {room.hasPassword && (
                        <svg className="w-4 h-4 text-slate-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                        </svg>
                      )}
                      {room.status === 'live' ? (
                        <span className="flex items-center gap-1 text-red-500 text-sm">
                          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                          Canli
                        </span>
                      ) : (
                        <span className="text-yellow-500 text-sm">Bekliyor</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm text-slate-500">
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      {room.participantCount} katilimci
                    </span>
                    <span>{room.maxSpeakers} konusmaci limiti</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Login prompt for non-authenticated users */}
      {!isAuthenticated && (
        <div className="max-w-md mx-auto mt-12 text-center">
          <p className="text-slate-400 mb-4">
            Acik odalari gormek ve katilmak icin giris yapin
          </p>
          <Link to="/login">
            <Button variant="secondary">Giris Yap</Button>
          </Link>
        </div>
      )}

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
              Oda Linki, Kodu veya Adi
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
