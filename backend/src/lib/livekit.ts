import { AccessToken, EgressClient, EncodedFileOutput, EncodedFileType } from 'livekit-server-sdk';

const LIVEKIT_URL = process.env.LIVEKIT_URL || '';
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || '';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || '';

export function createLiveKitToken(
  roomName: string,
  participantIdentity: string,
  canPublish: boolean = true
): string {
  const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity: participantIdentity,
    ttl: '24h',
  });

  token.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish,
    canSubscribe: true,
    canPublishData: true,
  });

  return token.toJwt();
}

export function getLiveKitUrl(): string {
  return LIVEKIT_URL;
}

// Egress for recording
let egressClient: EgressClient | null = null;

function getEgressClient(): EgressClient {
  if (!egressClient) {
    egressClient = new EgressClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
  }
  return egressClient;
}

export async function startRoomRecording(roomName: string): Promise<{ egressId: string }> {
  const client = getEgressClient();

  const output = new EncodedFileOutput({
    filepath: `recordings/${roomName}-${Date.now()}.mp3`,
    fileType: EncodedFileType.MP3,
  });

  const egress = await client.startRoomCompositeEgress(roomName, { file: output });

  return { egressId: egress.egressId };
}

export async function stopRoomRecording(egressId: string): Promise<void> {
  const client = getEgressClient();
  await client.stopEgress(egressId);
}
