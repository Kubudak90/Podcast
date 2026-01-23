import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '../components/UI';
import { api } from '../lib/api';
import { useAuthStore } from '../lib/store';

export function Login() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    setIsLoading(true);
    setError('');

    try {
      const response = await api.login(username.trim());
      api.setToken(response.token);
      setAuth(response.user, response.token);
      navigate('/');
    } catch {
      // If login fails, try to register
      try {
        const response = await api.register(username.trim());
        api.setToken(response.token);
        setAuth(response.user, response.token);
        navigate('/');
      } catch (regErr) {
        setError(regErr instanceof Error ? regErr.message : 'Giris yapilamadi');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen-safe flex items-center justify-center p-4 safe-area-pb">
      <div className="card w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold mb-2">Hos Geldin</h1>
          <p className="text-slate-400">
            Bir kullanici adi girerek basla
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Kullanici Adi
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ornegin: ahmet123"
              className="input"
              autoFocus
              minLength={2}
              maxLength={50}
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <Button type="submit" className="w-full" isLoading={isLoading}>
            Devam Et
          </Button>
        </form>

        <p className="text-center text-sm text-slate-400 mt-4">
          Hesabin yoksa otomatik olusturulacak
        </p>

        <div className="mt-6 pt-6 border-t border-slate-700 text-center">
          <Link
            to="/"
            className="text-sm text-primary-400 hover:text-primary-300 transition-colors"
          >
            Ana Sayfaya Don
          </Link>
        </div>
      </div>
    </div>
  );
}
