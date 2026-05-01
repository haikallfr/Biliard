import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export function makeRoomCode() {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

export function createRealtimeRoom(roomCode, playerId, handlers) {
  const room = roomCode.trim().toUpperCase();
  const sessionId = crypto.randomUUID();
  let sequence = 0;

  if (supabaseUrl && supabaseKey) {
    return createSupabaseRoom(room, playerId, handlers, () => nextMeta({ playerId, sessionId, room, sequence: ++sequence }));
  }

  return createLocalRoom(room, playerId, handlers, () => nextMeta({ playerId, sessionId, room, sequence: ++sequence }));
}

function createSupabaseRoom(room, playerId, handlers, meta) {
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
      channel.send({ type: "broadcast", event: "shot", payload: makeShotPayload(payload, meta()) });
    },
    sendSnapshot(payload) {
      channel.send({ type: "broadcast", event: "snapshot", payload: makeSnapshotPayload(payload, meta()) });
    },
    close() {
      channel.unsubscribe();
      client.removeChannel(channel);
    },
  };
}

function createLocalRoom(room, playerId, handlers, meta) {
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
      const metadata = meta();
      channel.postMessage({ type: "shot", payload: makeShotPayload(payload, metadata), playerId });
    },
    sendSnapshot(payload) {
      const metadata = meta();
      channel.postMessage({ type: "snapshot", payload: makeSnapshotPayload(payload, metadata), playerId });
    },
    close() {
      channel.close();
    },
  };
}

function nextMeta({ playerId, sessionId, room, sequence }) {
  return {
    protocol: "breakroom-sync-v2",
    playerId,
    sessionId,
    room,
    sequence,
    sentAt: Date.now(),
  };
}

function makeShotPayload(payload, meta) {
  return {
    ...meta,
    shot: normalizeShot(payload.shot),
    snapshot: payload.snapshot ? normalizeSnapshot(payload.snapshot) : undefined,
  };
}

function makeSnapshotPayload(payload, meta) {
  return {
    ...meta,
    snapshot: normalizeSnapshot(payload.snapshot),
  };
}

function normalizeShot(shot = {}) {
  return {
    id: shot.id ?? "cue",
    angle: round(shot.angle, 6),
    power: round(clamp(shot.power, 0, 1), 5),
    spin: {
      x: round(clamp(shot.spin?.x ?? 0, -1, 1), 5),
      y: round(clamp(shot.spin?.y ?? 0, -1, 1), 5),
    },
    turnToken: shot.turnToken ?? null,
    shotId: shot.shotId ?? `${shot.turnToken ?? "turn"}-${Date.now()}`,
  };
}

function normalizeSnapshot(snapshot = {}) {
  return {
    physicsVersion: snapshot.physicsVersion,
    timestamp: round(snapshot.timestamp, 4),
    rules: snapshot.rules,
    shot: snapshot.shot,
    balls: (snapshot.balls ?? [])
      .map((ball) => ({
        id: ball.id,
        position: normalizeVector(ball.position),
        velocity: normalizeVector(ball.velocity),
        angle: round(ball.angle, 4),
        angularVelocity: round(ball.angularVelocity, 4),
        spin: normalizeVector(ball.spin),
        pocketed: Boolean(ball.pocketed),
        lastContact: ball.lastContact ?? null,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  };
}

function normalizeVector(vector = {}) {
  return {
    x: round(vector.x, 4),
    y: round(vector.y, 4),
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(Number(value) || 0, min), max);
}

function round(value, precision = 4) {
  const multiplier = 10 ** precision;
  return Math.round((Number(value) || 0) * multiplier) / multiplier;
}
