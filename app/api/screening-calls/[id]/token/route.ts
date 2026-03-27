import { withApiHandler } from "@/src/lib/api-handler";
import { getLiveKitConfigStatus } from "@/src/lib/livekit";
import {
  getScreeningCall,
  updateScreeningCall,
} from "@/src/services/screening-calls";
import { RoomAgentDispatch, RoomConfiguration } from "@livekit/protocol";
import { AccessToken } from "livekit-server-sdk";

export const dynamic = "force-dynamic";

export const POST = withApiHandler(
  async (
    _request: Request,
    { params }: { params: Promise<{ id: string }> },
  ) => {
    const { id } = await params;
    const configStatus = getLiveKitConfigStatus();
    if (!configStatus.enabled) {
      return Response.json({ error: configStatus.error }, { status: 503 });
    }

    const call = await getScreeningCall(id);
    if (!call) {
      return Response.json(
        { error: "Screening call niet gevonden" },
        { status: 404 },
      );
    }

    const { apiKey, apiSecret, url } = configStatus.config;

    const at = new AccessToken(apiKey, apiSecret, {
      identity: `recruiter-${id.slice(0, 8)}`,
      name: "Recruiter",
      ttl: 1800, // 30 minutes in seconds
      metadata: JSON.stringify({
        callId: call.id,
        candidateId: call.candidateId,
        jobId: call.jobId,
        mode: "screening",
      }),
    });

    at.addGrant({
      room: call.roomName,
      roomJoin: true,
      canPublish: true,
      canPublishData: true,
      canSubscribe: true,
    });

    // Dispatch the screening agent with context
    const roomConfig = new RoomConfiguration();
    roomConfig.agents = [
      new RoomAgentDispatch({
        agentName: "motian-voice-agent",
        metadata: JSON.stringify({
          mode: "screening",
          callId: call.id,
          candidateContext: call.candidateContext,
          jobContext: call.jobContext,
          matchContext: call.matchContext,
          screeningQuestions: call.screeningQuestions,
        }),
      }),
    ];
    at.roomConfig = roomConfig;

    // Update call status to ringing
    await updateScreeningCall(id, {
      status: "ringing",
      startedAt: new Date(),
    });

    const participantToken = await at.toJwt();
    const clientUrl = (process.env.NEXT_PUBLIC_LIVEKIT_URL?.trim() || url).replace(/\/$/, "");

    return Response.json(
      {
        server_url: clientUrl,
        participant_token: participantToken,
        room_name: call.roomName,
      },
      { status: 201 },
    );
  },
);
