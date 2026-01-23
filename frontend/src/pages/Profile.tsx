import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../lib/store';
import { Avatar, Button, Modal } from '../components/UI';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { toast } from '../components/Toast';
import type { RoomHistoryItem } from '../types';

// Resmi canvas kullanarak yeniden boyutlandir
function resizeImage(file: File, maxSize: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // En-boy oranini koru
        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context alinamadi'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = () => reject(new Error('Resim yuklenemedi'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Dosya okunamadi'));
    reader.readAsDataURL(file);
  });
}

// Tarih formatlama yardimci fonksiyonu
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Rol badge'i
function RoleBadge({ role }: { role: string }) {
  const styles = {
    host: 'bg-primary-500/20 text-primary-400',
    speaker: 'bg-green-500/20 text-green-400',
    listener: 'bg-slate-500/20 text-slate-400',
  }[role] || 'bg-slate-500/20 text-slate-400';

  const labels = {
    host: 'Host',
    speaker: 'Konusmaci',
    listener: 'Dinleyici',
  };

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${styles}`}>
      {labels[role as keyof typeof labels] || role}
    </span>
  );
}

// Status badge'i
function StatusBadge({ status }: { status: string }) {
  const styles = {
    waiting: 'bg-yellow-500/20 text-yellow-400',
    live: 'bg-red-500/20 text-red-400',
    ended: 'bg-slate-500/20 text-slate-400',
  }[status] || 'bg-slate-500/20 text-slate-400';

  const labels = {
    waiting: 'Bekliyor',
    live: 'Canli',
    ended: 'Bitti',
  };

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${styles}`}>
      {labels[status as keyof typeof labels] || status}
    </span>
  );
}

export function Profile() {
  const { user, updateUser, logout } = useAuthStore();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showEditModal, setShowEditModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // Room history state
  const [roomHistory, setRoomHistory] = useState<RoomHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  // Edit form state
  const [editUsername, setEditUsername] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState<string | null>(null);

  // Fetch room history on mount
  useEffect(() => {
    const fetchRoomHistory = async () => {
      try {
        const rooms = await api.getRoomHistory(20);
        setRoomHistory(rooms);
      } catch (err) {
        console.error('Failed to fetch room history:', err);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    fetchRoomHistory();
  }, []);

  const handleLogout = () => {
    api.setToken(null);
    logout();
    navigate('/');
  };

  const openEditModal = () => {
    if (user) {
      setEditUsername(user.username);
      setEditEmail(user.email || '');
      setEditBio(user.bio || '');
      setEditAvatarUrl(user.avatarUrl || null);
      setError('');
    }
    setShowEditModal(true);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Dosya tipi kontrolu
    if (!file.type.startsWith('image/')) {
      toast.error('Lutfen bir resim dosyasi secin');
      return;
    }

    // Dosya boyutu kontrolu (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Dosya boyutu 5MB\'dan kucuk olmali');
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const resizedImage = await resizeImage(file, 200);
      setEditAvatarUrl(resizedImage);
    } catch {
      toast.error('Resim yuklenirken hata olustu');
    } finally {
      setIsUploadingAvatar(false);
    }

    // Input'u temizle (ayni dosyayi tekrar secebilmek icin)
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveAvatar = () => {
    setEditAvatarUrl(null);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editUsername.trim()) {
      setError('Kullanici adi gerekli');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const updatedUser = await api.updateProfile({
        username: editUsername.trim(),
        email: editEmail.trim() || null,
        bio: editBio.trim() || null,
        avatarUrl: editAvatarUrl,
      });

      updateUser(updatedUser);
      setShowEditModal(false);
      toast.success('Profil guncellendi');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Profil guncellenemedi');
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    navigate('/login');
    return null;
  }

  return (
    <div className="min-h-screen-safe p-4 safe-area-pb">
      <div className="max-w-2xl mx-auto">
        {/* Profile Card */}
        <div className="card mb-6">
          <div className="flex items-center gap-4">
            <Avatar name={user.username} src={user.avatarUrl || undefined} size="xl" />
            <div className="flex-1">
              <h1 className="text-2xl font-bold">{user.username}</h1>
              {user.email && (
                <p className="text-slate-400">{user.email}</p>
              )}
              {user.bio && (
                <p className="text-slate-300 mt-2">{user.bio}</p>
              )}
              <p className="text-sm text-slate-500 mt-1">
                Uye: {new Date(user.createdAt).toLocaleDateString('tr-TR')}
              </p>
            </div>
            <Button variant="secondary" onClick={openEditModal}>
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              Duzenle
            </Button>
          </div>
        </div>

        {/* Room History */}
        <div className="card mb-6">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Oda Gecmisi
          </h2>

          {isLoadingHistory ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" />
            </div>
          ) : roomHistory.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              <p>Henuz bir odaya katilmadiniz</p>
              <Link to="/" className="text-primary-400 hover:text-primary-300 text-sm mt-2 inline-block">
                Bir oda olusturun veya katiltin
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {roomHistory.map((room) => (
                <Link
                  key={room.id}
                  to={room.status === 'ended' ? `/room/${room.slug}/ended` : `/room/${room.slug}`}
                  className="block bg-slate-800 hover:bg-slate-700 rounded-lg p-4 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium truncate">{room.title}</h3>
                        <StatusBadge status={room.status} />
                        <RoleBadge role={room.role} />
                      </div>
                      <div className="flex items-center gap-3 text-sm text-slate-400">
                        <span className="flex items-center gap-1">
                          <Avatar name={room.host.username} src={room.host.avatarUrl} size="sm" />
                          {room.host.username}
                        </span>
                        <span>{room.participantCount} katilimci</span>
                        {room.recordingCount > 0 && (
                          <span className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <circle cx="10" cy="10" r="3" />
                            </svg>
                            {room.recordingCount} kayit
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-2">
                        {formatDate(room.joinedAt)}
                      </p>
                    </div>
                    <svg className="w-5 h-5 text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Settings */}
        <div className="card">
          <h2 className="font-semibold mb-4">Ayarlar</h2>
          <Button variant="danger" onClick={handleLogout}>
            Cikis Yap
          </Button>
        </div>
      </div>

      {/* Edit Profile Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setError('');
        }}
        title="Profili Duzenle"
      >
        <form onSubmit={handleUpdateProfile} className="space-y-4">
          {/* Avatar Section */}
          <div className="flex flex-col items-center gap-3 pb-4 border-b border-slate-700">
            <div className="relative">
              <Avatar
                name={editUsername || user.username}
                src={editAvatarUrl || undefined}
                size="xl"
              />
              {isUploadingAvatar && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                  <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" />
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingAvatar}
              >
                <svg
                  className="w-4 h-4 mr-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                Foto Sec
              </Button>
              {editAvatarUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveAvatar}
                >
                  <svg
                    className="w-4 h-4 mr-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                  Kaldir
                </Button>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Max 5MB, PNG/JPG/GIF
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Kullanici Adi
            </label>
            <input
              type="text"
              value={editUsername}
              onChange={(e) => setEditUsername(e.target.value)}
              placeholder="kullanici_adi"
              className="input"
              minLength={2}
              maxLength={50}
              pattern="^[a-zA-Z0-9_]+$"
              title="Sadece harf, rakam ve alt cizgi kullanabilirsiniz"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              E-posta (opsiyonel)
            </label>
            <input
              type="email"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
              placeholder="ornek@mail.com"
              className="input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Hakkinda (opsiyonel)
            </label>
            <textarea
              value={editBio}
              onChange={(e) => setEditBio(e.target.value)}
              placeholder="Kendinizden kisaca bahsedin..."
              className="input resize-none"
              rows={3}
              maxLength={200}
            />
            <p className="text-xs text-slate-500 mt-1">
              {editBio.length}/200 karakter
            </p>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-3">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setShowEditModal(false);
                setError('');
              }}
            >
              Iptal
            </Button>
            <Button type="submit" className="flex-1" isLoading={isLoading}>
              Kaydet
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
