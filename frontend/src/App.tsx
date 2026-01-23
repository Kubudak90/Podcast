import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Header } from './components/Layout';
import { Home, Login, Room, RoomEnded, Profile } from './pages';
import ErrorBoundary from './components/ErrorBoundary';
import { useEffect } from 'react';
import { api } from './lib/api';
import { useAuthStore } from './lib/store';

function App() {
  const { token, setAuth, logout } = useAuthStore();

  useEffect(() => {
    // Initialize API token from store
    if (token) {
      api.setToken(token);
      // Verify token is still valid
      api.me().then(user => {
        setAuth(user, token);
      }).catch(() => {
        api.setToken(null);
        logout();
      });
    }
  }, [token, setAuth, logout]);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <div className="min-h-screen bg-slate-900">
          <Header />
          <main>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/room/:slug" element={<Room />} />
              <Route path="/room/:slug/ended" element={<RoomEnded />} />
              <Route path="/profile" element={<Profile />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
