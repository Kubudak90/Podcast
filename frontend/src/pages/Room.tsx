import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useParticipants,
  useLocalParticipant,
  useTracks,
  useConnectionState,
} from '@livekit/components-react';
import { Track, ConnectionState } from 'livekit-client';
import { Button, Avatar, VolumeSlider, AudioLevelMeter } from '../components/UI';
import { toast } from '../components/Toast';
import { Chat } from '../components/Chat';
import { api } from '../lib/api';
import { useAuthStore, useRoomStore, useAudioSettingsStore } from '../lib/store';
import { useSocket } from '../hooks/useSocket';
import type { Room as RoomType } from '../types';

// Mikrofon izni kontrolu
async function checkMicrophonePermission(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());
    return true;
  } catch (err) {
    console.error('Mikrofon izni alinamadi:', err);
    return false;
  }
}

function ParticipantTile({
  participant,
  isLocal = false,
  onVolumeChange
}: {
  participant: ReturnType<typeof useParticipants>[0];
  isLocal?: boolean;
  onVolumeChange?: (volume: number) => void;
}) {
  const tracks = useTracks([Track.Source.Microphone], {
    onlySubscribed: true,
  });
  const { participantVolumes, setParticipantVolume } = useAudioSettingsStore();
  const [showVolumeControl, setShowVolumeControl] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const audioLevelRef = useRef<number>(0);

  // Get participant's audio track
  const participantTrack = tracks.find(
    (t) => t.participant.identity === participant.identity
  );

  const isSpeaking = participantTrack?.participant.isSpeaking ?? false;
  const isMuted = !participant.isMicrophoneEnabled;

  // Track audio level with smoothing
  useEffect(() => {
    if (!participantTrack?.participant) return;

    const updateAudioLevel = () => {
      const level = participantTrack.participant.audioLevel ?? 0;
      // Smooth the audio level for better visual effect
      audioLevelRef.current = audioLevelRef.current * 0.7 + level * 0.3;
      setAudioLevel(audioLevelRef.current);
    };

    const interval = setInterval(updateAudioLevel, 50);
    return () => clearInterval(interval);
  }, [participantTrack]);

  const volume = participantVolumes[participant.identity] ?? 1;

  const handleVolumeChange = (newVolume: number) => {
    setParticipantVolume(participant.identity, newVolume);
    onVolumeChange?.(newVolume);
  };

  return (
    <div
      className="flex flex-col items-center gap-2 p-4 bg-slate-800 rounded-xl relative group cursor-pointer"
      onClick={() => !isLocal && setShowVolumeControl(!showVolumeControl)}
    >
      <div className="relative">
        <Avatar
          name={participant.identity}
          size="lg"
          isSpeaking={isSpeaking}
          audioLevel={audioLevel}
          showAudioLevel={isSpeaking && !isMuted}
        />
        {isMuted && (
          <div className="absolute -bottom-1 -right-1 bg-red-500 rounded-full p-1 z-20">
            <svg
              className="w-3 h-3 text-white"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Audio level meter */}
      {!isMuted && (
        <AudioLevelMeter level={audioLevel} size="sm" barCount={5} />
      )}

      <span className="text-sm font-medium truncate max-w-[100px]">
        {participant.identity}
        {isLocal && <span className="text-slate-400 text-xs ml-1">(Sen)</span>}
      </span>

      {/* Volume control popup for remote participants */}
      {!isLocal && showVolumeControl && (
        <div
          className="absolute top-full mt-2 bg-slate-700 rounded-lg p-3 shadow-lg z-30"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2 min-w-[140px]">
            <VolumeSlider
              value={volume}
              onChange={handleVolumeChange}
              size="sm"
            />
            <span className="text-xs text-slate-400 w-8">
              {Math.round(volume * 100)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function RoomContent({ room }: { room: RoomType }) {
  const navigate = useNavigate();
  const { isHost, isMuted, setIsMuted, setIsSpeaker, reset } = useRoomStore();
  const { masterVolume, setMasterVolume } = useAudioSettingsStore();
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const connectionState = useConnectionState();
  const [isLive, setIsLive] = useState(room.status === 'live');
  const [micPermission, setMicPermission] = useState<boolean | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [showMasterVolume, setShowMasterVolume] = useState(false);

  // Socket event handlers for real-time updates
  const handleStatusChanged = useCallback((payload: { status: string; isRecording?: boolean }) => {
    if (payload.status === 'live') {
      setIsLive(true);
    } else if (payload.status === 'ended') {
      navigate(`/room/${room.slug}/ended`);
    }
  }, [navigate, room.slug]);

  const handleRoleChanged = useCallback((payload: { userId: string; role: string }) => {
    const currentUserId = useAuthStore.getState().user?.id;
    if (payload.userId === currentUserId) {
      const newIsSpeaker = payload.role === 'speaker' || payload.role === 'host';
      setIsSpeaker(newIsSpeaker);
      toast.info(newIsSpeaker ? 'Konusmaci oldun!' : 'Dinleyici moduna aldiniz');
    }
  }, [setIsSpeaker]);

  const handleRecordingError = useCallback((payload: { error: string }) => {
    toast.error(payload.error);
  }, []);

  // Connect to socket room channel
  useSocket({
    roomSlug: room.slug,
    onStatusChanged: handleStatusChanged,
    onRoleChanged: handleRoleChanged,
    onRecordingError: handleRecordingError,
  });

  // Mikrofon izni kontrolu
  useEffect(() => {
    checkMicrophonePermission().then(setMicPermission);
  }, []);

  // Mikrofonu localParticipant durumu ile senkronize et
  useEffect(() => {
    if (localParticipant) {
      const micEnabled = localParticipant.isMicrophoneEnabled;
      setIsMuted(!micEnabled);
    }
  }, [localParticipant, localParticipant?.isMicrophoneEnabled, setIsMuted]);

  const handleToggleMute = async () => {
    if (!localParticipant) return;

    // Mikrofon izni yoksa iste
    if (!micPermission) {
      const hasPermission = await checkMicrophonePermission();
      setMicPermission(hasPermission);
      if (!hasPermission) {
        alert('Mikrofon izni gerekli. Lutfen tarayici ayarlarindan izin verin.');
        return;
      }
    }

    try {
      const newMicState = !localParticipant.isMicrophoneEnabled;
      await localParticipant.setMicrophoneEnabled(newMicState);
      setIsMuted(!newMicState);
    } catch (err) {
      console.error('Mikrofon durumu degistirilemedi:', err);
      alert('Mikrofon acilamadi. Lutfen tarayici ayarlarinizi kontrol edin.');
    }
  };

  const handleStartRoom = async () => {
    try {
      await api.startRoom(room.slug);
      setIsLive(true);
      toast.success('Yayin basladi!');
    } catch (err) {
      console.error('Failed to start room:', err);
      toast.error('Yayin baslatilamadi');
    }
  };

  const handleEndRoom = async () => {
    try {
      await api.endRoom(room.slug);
      navigate(`/room/${room.slug}/ended`);
    } catch (err) {
      console.error('Failed to end room:', err);
      toast.error('Yayin bitirilemedi');
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
    toast.success('Link panoya kopyalandi!');
  };

  return (
    <div className="min-h-screen-safe flex flex-col">
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
              {connectionState !== ConnectionState.Connected && (
                <span className="flex items-center gap-1 text-yellow-500 text-sm">
                  <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                  {connectionState === ConnectionState.Connecting ? 'Baglaniyor...' : 'Baglanti kesik'}
                </span>
              )}
              {micPermission === false && (
                <span className="text-orange-400 text-sm">Mikrofon izni yok</span>
              )}
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
                isLocal={participant.identity === localParticipant?.identity}
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

          {/* Master Volume Control */}
          <div className="relative">
            <Button
              variant="secondary"
              size="lg"
              onClick={() => setShowMasterVolume(!showMasterVolume)}
              className="rounded-full w-14 h-14"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                {masterVolume === 0 ? (
                  <path
                    fillRule="evenodd"
                    d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                ) : (
                  <path
                    fillRule="evenodd"
                    d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z"
                    clipRule="evenodd"
                  />
                )}
              </svg>
            </Button>

            {/* Master Volume Popup */}
            {showMasterVolume && (
              <div
                className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-700 rounded-lg p-3 shadow-lg z-30"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex flex-col items-center gap-2">
                  <span className="text-xs text-slate-400">Ana Ses</span>
                  <VolumeSlider
                    value={masterVolume}
                    onChange={setMasterVolume}
                    orientation="vertical"
                    showIcon={false}
                  />
                  <span className="text-xs text-slate-300">
                    {Math.round(masterVolume * 100)}%
                  </span>
                </div>
              </div>
            )}
          </div>

          <Button
            variant="secondary"
            size="lg"
            onClick={() => setIsChatOpen(true)}
            className="rounded-full w-14 h-14"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z"
                clipRule="evenodd"
              />
            </svg>
          </Button>
        </div>
      </div>

      <RoomAudioRenderer />

      {/* Chat Panel */}
      <Chat roomSlug={room.slug} isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
    </div>
  );
}

export function Room() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const { setCurrentRoom, setIsHost, setIsSpeaker } = useRoomStore();

  const [room, setRoom] = useState<RoomType | null>(null);
  const [livekitToken, setLivekitToken] = useState<string | null>(null);
  const [livekitUrl, setLivekitUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Odaya baglandiginda mikrofonu otomatik ac
  const handleConnected = useCallback(() => {
    // Mikrofon otomatik acilacak (audio={true} sayesinde)
  }, []);

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
      <div className="min-h-screen-safe flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen-safe flex items-center justify-center p-4">
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
      onConnected={handleConnected}
      onError={(error) => {
        console.error('LiveKit error:', error);
        setError(`Baglanti hatasi: ${error.message}`);
      }}
      options={{
        audioCaptureDefaults: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true,
        },
        publishDefaults: {
          audioPreset: {
            maxBitrate: 64000,
          },
          dtx: true,
          red: true,
        },
        disconnectOnPageLeave: true,
        adaptiveStream: true,
        dynacast: true,
      }}
    >
      <RoomContent room={room} />
    </LiveKitRoom>
  );
}
