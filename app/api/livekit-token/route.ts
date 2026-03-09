import { RoomAgentDispatch, RoomConfiguration } from "@livekit/protocol";
import { AccessToken } from "livekit-server-sdk";
import { nanoid } from "nanoid";

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL ?? process.env.LIVEKIT_URL;

/**
 * Token endpoint compatible with LiveKit's TokenSourceEndpoint format.
 *
 * The client sends a TokenSourceRequest (snake_case JSON) with optional fields
 * like room_name, participant_name, agent_name. We generate a JWT and return
 * { server_url, participant_token } (TokenSourceResponse format).
 */
export async function POST(req: Request) {
  if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_URL) {
    return Response.json({ error: "LiveKit niet geconfigureerd" }, { status: 500 });
  }

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

  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
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
  return Response.json({
    server_url: LIVEKIT_URL,
    participant_token: participantToken,
  });
}
