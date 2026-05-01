import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export function makeRoomCode() {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

export function createRealtimeRoom(roomCode, playerId, handlers) {
  const room = roomCode.trim().toUpperCase();

  if (supabaseUrl && supabaseKey) {
    return createSupabaseRoom(room, playerId, handlers);
  }

  return createLocalRoom(room, playerId, handlers);
}

function createSupabaseRoom(room, playerId, handlers) {
  const client = createClient(supabaseUrl, supabaseKey);
  const channel = client.channel(`pool-room-${room}`, {
    config: { broadcast: { self: false }, presence: { key: playerId } },
  });

  channel
    .on("broadcast", { event: "shot" }, ({ payload }) => handlers.onShot?.(payload))
    .on("broadcast", { event: "snapshot" }, ({ payload }) => handlers.onSnapshot?.(payload))
    .on("presence", { event: "sync" }, () => {
      handlers.onPresence?.(Object.keys(channel.presenceState()).length);
    })
    .subscribe(async (status) => {
      if (status !== "SUBSCRIBED") return;
      await channel.track({ playerId, onlineAt: new Date().toISOString() });
      handlers.onReady?.("supabase");
    });

  return {
    transport: "supabase",
    sendShot(payload) {
      channel.send({ type: "broadcast", event: "shot", payload: { ...payload, playerId } });
    },
    sendSnapshot(payload) {
      channel.send({ type: "broadcast", event: "snapshot", payload: { ...payload, playerId } });
    },
    close() {
      channel.unsubscribe();
      client.removeChannel(channel);
    },
  };
}

function createLocalRoom(room, playerId, handlers) {
  const channel = new BroadcastChannel(`pool-room-${room}`);
  channel.onmessage = ({ data }) => {
    if (!data || data.playerId === playerId) return;
    if (data.type === "shot") handlers.onShot?.(data.payload);
    if (data.type === "snapshot") handlers.onSnapshot?.(data.payload);
  };

  window.setTimeout(() => handlers.onReady?.("local"), 0);

  return {
    transport: "local",
    sendShot(payload) {
      channel.postMessage({ type: "shot", payload, playerId });
    },
    sendSnapshot(payload) {
      channel.postMessage({ type: "snapshot", payload, playerId });
    },
    close() {
      channel.close();
    },
  };
}
