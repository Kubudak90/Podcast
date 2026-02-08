import { AccessToken, EgressClient, EncodedFileOutput, EncodedFileType, S3Upload } from 'livekit-server-sdk';

const LIVEKIT_URL = process.env.LIVEKIT_URL || '';
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || '';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || '';

// S3/R2 config for recording uploads
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY || '';
const S3_SECRET_KEY = process.env.S3_SECRET_KEY || '';
const S3_BUCKET = process.env.S3_BUCKET || 'podchat-recordings';
const S3_ENDPOINT = process.env.S3_ENDPOINT || '';
const S3_REGION = process.env.S3_REGION || 'auto';

export async function createLiveKitToken(
  roomName: string,
  participantIdentity: string,
  canPublish: boolean = true
): Promise<string> {
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

  return await token.toJwt();
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

export async function startRoomRecording(roomName: string, timestamp: number): Promise<{ egressId: string; filepath: string; fileUrl: string }> {
  const client = getEgressClient();

  const filepath = `recordings/${roomName}-${timestamp}.mp3`;

  // Configure S3 upload so recordings go directly to cloud storage
  const s3Output = new S3Upload({
    accessKey: S3_ACCESS_KEY,
    secret: S3_SECRET_KEY,
    bucket: S3_BUCKET,
    region: S3_REGION,
    endpoint: S3_ENDPOINT || undefined,
    forcePathStyle: true,
  });

  const output = new EncodedFileOutput({
    filepath,
    fileType: EncodedFileType.MP3,
    output: { case: 's3', value: s3Output },
  });

  const egress = await client.startRoomCompositeEgress(roomName, { file: output });

  // Construct the full S3 URL for database storage
  const fileUrl = S3_ENDPOINT
    ? `${S3_ENDPOINT}/${S3_BUCKET}/${filepath}`
    : `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${filepath}`;

  return { egressId: egress.egressId, filepath, fileUrl };
}

export async function stopRoomRecording(egressId: string): Promise<void> {
  const client = getEgressClient();
  await client.stopEgress(egressId);
}
