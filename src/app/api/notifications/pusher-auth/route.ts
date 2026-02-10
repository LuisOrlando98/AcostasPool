import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import type Pusher from "pusher";

let pusherClient: Pusher | null = null;

const getPusher = () => {
  if (pusherClient) {
    return pusherClient;
  }

  const appId = process.env.PUSHER_APP_ID;
  const key = process.env.PUSHER_KEY;
  const secret = process.env.PUSHER_SECRET;
  const cluster = process.env.PUSHER_CLUSTER;

  if (!appId || !key || !secret || !cluster) {
    return null;
  }

  const PusherLib = require("pusher") as typeof Pusher;
  pusherClient = new PusherLib({
    appId,
    key,
    secret,
    cluster,
    useTLS: true,
  });

  return pusherClient;
};

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = getPusher();
  if (!client) {
    return NextResponse.json({ error: "Realtime disabled" }, { status: 400 });
  }

  const body = await request.text();
  const params = new URLSearchParams(body);
  const socketId = params.get("socket_id");
  const channelName = params.get("channel_name");

  if (!socketId || !channelName) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const allowedChannel = `private-user-${session.sub}`;
  if (channelName !== allowedChannel) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const auth = client.authorizeChannel(socketId, channelName);
  return NextResponse.json(auth);
}
