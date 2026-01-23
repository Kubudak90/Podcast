import { useState } from 'react';
import { api } from '../lib/api';

interface FollowButtonProps {
  userId: string;
  isFollowing: boolean;
  onFollowChange?: (isFollowing: boolean) => void;
  size?: 'sm' | 'md';
}

export function FollowButton({ userId, isFollowing: initialFollowing, onFollowChange, size = 'md' }: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(initialFollowing);
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      if (isFollowing) {
        await api.unfollowUser(userId);
        setIsFollowing(false);
        onFollowChange?.(false);
      } else {
        await api.followUser(userId);
        setIsFollowing(true);
        onFollowChange?.(true);
      }
    } catch (error) {
      console.error('Follow error:', error);
    } finally {
      setLoading(false);
    }
  };

  const sizeClasses = size === 'sm' ? 'px-3 py-1 text-sm' : 'px-4 py-2';

  if (isFollowing) {
    return (
      <button
        onClick={handleClick}
        disabled={loading}
        className={`${sizeClasses} bg-slate-700 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-50 group`}
      >
        <span className="group-hover:hidden">{loading ? '...' : 'Following'}</span>
        <span className="hidden group-hover:inline">Unfollow</span>
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`${sizeClasses} bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-colors disabled:opacity-50`}
    >
      {loading ? '...' : 'Follow'}
    </button>
  );
}
