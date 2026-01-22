import { Link } from 'react-router-dom';
import { useAuthStore } from '../../lib/store';
import { Avatar } from '../UI';

export function Header() {
  const { user, isAuthenticated, logout } = useAuthStore();

  return (
    <header className="bg-slate-800 border-b border-slate-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
              <svg
                className="w-5 h-5 text-white"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <span className="text-xl font-bold">PodChat</span>
          </Link>

          <div className="flex items-center gap-4">
            {isAuthenticated && user ? (
              <div className="flex items-center gap-3">
                <Link
                  to="/profile"
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  <Avatar name={user.username} size="sm" />
                  <span className="text-sm font-medium hidden sm:block">
                    {user.username}
                  </span>
                </Link>
                <button
                  onClick={logout}
                  className="text-sm text-slate-400 hover:text-white transition-colors"
                >
                  Cikis
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="text-sm font-medium text-primary-400 hover:text-primary-300 transition-colors"
              >
                Giris Yap
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
