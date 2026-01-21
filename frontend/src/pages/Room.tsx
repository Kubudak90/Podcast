import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useParticipants,
  useLocalParticipant,
  useTracks,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { Button, Avatar } from '../components/UI';
import { api } from '../lib/api';
import { useAuthStore, useRoomStore } from '../lib/store';
import type { Room as RoomType } from '../types';

function ParticipantTile({ participant }: { participant: ReturnType<typeof useParticipants>[0] }) {
  const tracks = useTracks([Track.Source.Microphone], {
    onlySubscribed: true,
  });

  const isSpeaking = tracks.some(
    (t) => t.participant.identity === participant.identity && t.participant.isSpeaking
  );

  const isMuted = !participant.isMicrophoneEnabled;

  return (
    <div className="flex flex-col items-center gap-2 p-4 bg-slate-800 rounded-xl">
      <div className="relative">
        <Avatar
          name={participant.identity}
          size="lg"
          isSpeaking={isSpeaking}
        />
        {isMuted && (
          <div className="absolute -bottom-1 -right-1 bg-red-500 rounded-full p-1">
            <svg
              className="w-3 h-3 text-white"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M5.05 3.636a1 1 0 010 1.414L3.414 6.686l1.636 1.636a1 1 0 01-1.414 1.414L2 8.1l-1.636 1.636a1 1 0 01-1.414-1.414L.586 6.686.95 6.322a1 1 0 011.414 0L4 7.958l1.05-1.05a1 1 0 011.414 0l1.05 1.05 1.636-1.636a1 1 0 011.414 1.414L8.928 9.372l1.636 1.636a1 1 0 01-1.414 1.414L7.514 10.786 5.878 12.422a1 1 0 01-1.414-1.414L6.1 9.372 4.464 7.736a1 1 0 010-1.414L5.05 5.736l.586-.586a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        )}
      </div>
      <span className="text-sm font-medium truncate max-w-[100px]">
        {participant.identity}
      </span>
    </div>
  );
}

function RoomContent({ room }: { room: RoomType }) {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { isHost, isMuted, toggleMute, reset } = useRoomStore();
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const [isLive, setIsLive] = useState(room.status === 'live');

  const handleToggleMute = async () => {
    if (localParticipant) {
      await localParticipant.setMicrophoneEnabled(isMuted);
      toggleMute();
    }
  };

  const handleStartRoom = async () => {
    try {
      await api.startRoom(room.slug);
      setIsLive(true);
    } catch (err) {
      console.error('Failed to start room:', err);
    }
  };

  const handleEndRoom = async () => {
    try {
      await api.endRoom(room.slug);
      navigate(`/room/${room.slug}/ended`);
    } catch (err) {
      console.error('Failed to end room:', err);
    }
  };

  const handleLeave = async () => {
    try {
      await api.leaveRoom(room.slug);
      reset();
      navigate('/');
    } catch (err) {
      console.error('Failed to leave room:', err);
      reset();
      navigate('/');
    }
  };

  const copyLink = () => {
    const url = `${window.location.origin}/room/${room.slug}`;
    navigator.clipboard.writeText(url);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">{room.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              {isLive ? (
                <span className="flex items-center gap-1 text-red-500 text-sm">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  Canli
                </span>
              ) : (
                <span className="text-slate-400 text-sm">Bekliyor</span>
              )}
              <span className="text-slate-500 text-sm">
                {participants.length} katilimci
              </span>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={copyLink}>
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
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            Link Kopyala
          </Button>
        </div>
      </div>

      {/* Participants */}
      <div className="flex-1 p-4 overflow-auto">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {participants.map((participant) => (
              <ParticipantTile
                key={participant.identity}
                participant={participant}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-slate-800 border-t border-slate-700 p-4 safe-area-pb">
        <div className="max-w-4xl mx-auto flex items-center justify-center gap-4">
          <Button
            variant={isMuted ? 'danger' : 'secondary'}
            size="lg"
            onClick={handleToggleMute}
            className="rounded-full w-14 h-14"
          >
            {isMuted ? (
              <svg
                className="w-6 h-6"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg
                className="w-6 h-6"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </Button>

          {isHost && !isLive && (
            <Button size="lg" onClick={handleStartRoom}>
              Yayini Baslat
            </Button>
          )}

          {isHost && isLive && (
            <Button variant="danger" size="lg" onClick={handleEndRoom}>
              Yayini Bitir
            </Button>
          )}

          <Button variant="ghost" size="lg" onClick={handleLeave}>
            Ayril
          </Button>
        </div>
      </div>

      <RoomAudioRenderer />
    </div>
  );
}

export function Room() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();
  const { setCurrentRoom, setIsHost, setIsSpeaker } = useRoomStore();

  const [room, setRoom] = useState<RoomType | null>(null);
  const [livekitToken, setLivekitToken] = useState<string | null>(null);
  const [livekitUrl, setLivekitUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    const initRoom = async () => {
      if (!slug) return;

      try {
        // Join room
        const { room: roomData, participant } = await api.joinRoom(slug);
        setRoom(roomData);
        setCurrentRoom(roomData);
        setIsHost(participant.role === 'host');
        setIsSpeaker(participant.role === 'host' || participant.role === 'speaker');

        // Get LiveKit token
        const { token, url } = await api.getLiveKitToken(slug);
        setLivekitToken(token);
        setLivekitUrl(url);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Odaya baglanilamadi');
      } finally {
        setIsLoading(false);
      }
    };

    initRoom();
  }, [slug, isAuthenticated, navigate, setCurrentRoom, setIsHost, setIsSpeaker]);

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
        <div className="card text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <Button onClick={() => navigate('/')}>Ana Sayfaya Don</Button>
        </div>
      </div>
    );
  }

  if (!room || !livekitToken || !livekitUrl) {
    return null;
  }

  return (
    <LiveKitRoom
      token={livekitToken}
      serverUrl={livekitUrl}
      connect={true}
      audio={true}
      video={false}
    >
      <RoomContent room={room} />
    </LiveKitRoom>
  );
}
