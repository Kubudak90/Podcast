import { useAuthStore } from '../lib/store';
import { Avatar, Button } from '../components/UI';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

export function Profile() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    api.setToken(null);
    logout();
    navigate('/');
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
            <div>
              <h1 className="text-2xl font-bold">{user.username}</h1>
              {user.email && (
                <p className="text-slate-400">{user.email}</p>
              )}
              <p className="text-sm text-slate-500 mt-1">
                Uye: {new Date(user.createdAt).toLocaleDateString('tr-TR')}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="font-semibold mb-4">Ayarlar</h2>
          <Button variant="danger" onClick={handleLogout}>
            Cikis Yap
          </Button>
        </div>
      </div>
    </div>
  );
}
