import { useState } from 'react';
import { useAuthStore } from '../lib/store';
import { Avatar, Button, Modal } from '../components/UI';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { toast } from '../components/Toast';

export function Profile() {
  const { user, updateUser, logout } = useAuthStore();
  const navigate = useNavigate();

  const [showEditModal, setShowEditModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Edit form state
  const [editUsername, setEditUsername] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editBio, setEditBio] = useState('');

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
      setError('');
    }
    setShowEditModal(true);
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
        <div className="card mb-6">
          <div className="flex items-center gap-4">
            <Avatar name={user.username} size="xl" />
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
