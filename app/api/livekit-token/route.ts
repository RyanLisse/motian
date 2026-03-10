import { RoomAgentDispatch, RoomConfiguration } from "@livekit/protocol";
import { AccessToken } from "livekit-server-sdk";
import { nanoid } from "nanoid";
import { getLiveKitConfigStatus } from "@/src/lib/livekit";

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET() {
  const configStatus = getLiveKitConfigStatus();

  if (!configStatus.enabled) {
    return json({ enabled: false, error: configStatus.error }, 503);
  }

  return json({ enabled: true });
}

/**
 * Token endpoint compatible with LiveKit's TokenSourceEndpoint format.
 *
 * The client sends a TokenSourceRequest (snake_case JSON) with optional fields
 * like room_name, participant_name, agent_name. We generate a JWT and return
 * { server_url, participant_token } (TokenSourceResponse format).
 */
export async function POST(req: Request) {
  const configStatus = getLiveKitConfigStatus();

  if (!configStatus.enabled) {
    return json({ error: configStatus.error }, 503);
  }

  const { apiKey, apiSecret, url } = configStatus.config;

  // Parse optional request body from TokenSourceEndpoint
  let roomName = `motian-voice-${nanoid(8)}`;
  let participantName = "Recruiter";
  let participantIdentity = `recruiter-${nanoid(6)}`;

  try {
    const body = await req.json();
    if (body.room_name) roomName = body.room_name;
    if (body.participant_name) participantName = body.participant_name;
    if (body.participant_identity) participantIdentity = body.participant_identity;
  } catch {
    // No body or invalid JSON — use defaults
  }

  const at = new AccessToken(apiKey, apiSecret, {
    identity: participantIdentity,
    name: participantName,
    ttl: "15m",
  });

  at.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
  });

  // Dispatch the voice agent to the room automatically
  at.roomConfig = new RoomConfiguration({
    agents: [new RoomAgentDispatch({ agentName: "motian-voice-agent" })],
  });

  const participantToken = await at.toJwt();

  // Return in TokenSourceResponse wire format (snake_case)
  return json({
    server_url: url,
    participant_token: participantToken,
  });
}
