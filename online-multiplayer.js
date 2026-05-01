(function () {
  const CONFIG = window.BREAKROOM_CONFIG || {};
  const ROOM_PREFIX = "breakroom-8";
  const LOCAL_EVENT = "breakroom-local-room";
  const clientId = createRuntimeId();

  const session = {
    active: false,
    connected: false,
    room: "",
    player: "p1",
    role: "host",
    transport: null,
    sequence: 0,
    lastSentKey: "",
    lastAppliedAt: 0,
    lastRemoteByClient: new Map(),
    lastRemoteAt: 0,
    started: false,
    applying: false,
    panel: null,
    statusEl: null,
    noteEl: null,
    roomInput: null,
    copyButton: null,
  };

  ready(() => {
    buildPanel();
    setInterval(guardInputForTurn, 60);
    setInterval(syncLoop, 220);
  });

  function ready(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
      return;
    }
    callback();
  }

  function buildPanel() {
    const panel = document.createElement("section");
    panel.className = "online-panel";
    panel.innerHTML = `
      <div class="online-heading">
        <strong>Online Room</strong>
        <span data-online-status>Not connected</span>
      </div>
      <div class="online-row">
        <button type="button" data-host-room>Host</button>
        <input data-room-code maxlength="8" placeholder="ROOM" autocapitalize="characters" />
        <button type="button" data-join-room>Join</button>
        <button type="button" data-copy-room disabled>Copy Link</button>
      </div>
      <p data-online-note></p>
    `;
    document.body.appendChild(panel);

    session.panel = panel;
    session.roomInput = panel.querySelector("[data-room-code]");
    session.statusEl = panel.querySelector("[data-online-status]");
    session.noteEl = panel.querySelector("[data-online-note]");
    session.copyButton = panel.querySelector("[data-copy-room]");

    const roomFromUrl = getRoomFromUrl();
    if (roomFromUrl) {
      session.roomInput.value = roomFromUrl;
      setNote(`Room ${roomFromUrl} terbaca dari link. Tekan Join untuk masuk sebagai Player 2.`);
    } else if (hasSupabaseConfig()) {
      setNote("Online siap. Host room, bagikan kode/link ke lawan, lalu mulai main.");
    } else {
      setNote("Supabase belum dikonfigurasi. Mode beda device belum aktif; fallback hanya untuk test antar tab browser.");
    }

    panel.querySelector("[data-host-room]").addEventListener("click", async () => {
      const room = makeRoomCode();
      session.roomInput.value = room;
      updateRoomUrl(room);
      await startOnlineRoom({ room, player: "p1", role: "host" });
    });

    panel.querySelector("[data-join-room]").addEventListener("click", async () => {
      const room = cleanRoomCode(session.roomInput.value);
      if (!room) {
        setNote("Masukkan kode room dari host.");
        return;
      }
      session.roomInput.value = room;
      updateRoomUrl(room);
      await startOnlineRoom({ room, player: "p2", role: "guest" });
    });

    session.copyButton.addEventListener("click", copyRoomLink);
  }

  async function startOnlineRoom({ room, player, role }) {
    session.active = true;
    session.connected = false;
    session.room = cleanRoomCode(room);
    session.player = player;
    session.role = role;
    session.sequence = 0;
    session.lastSentKey = "";
    session.lastAppliedAt = 0;
    session.lastRemoteByClient = new Map();
    session.lastRemoteAt = 0;
    session.started = false;

    document.body.classList.add("online-active");
    document.body.dataset.onlinePlayer = player;
    document.body.dataset.onlineTransport = hasSupabaseConfig() ? "supabase" : "local";

    setStatus(`${role === "host" ? "Host" : "Guest"} ${session.room}`);
    setNote(hasSupabaseConfig() ? "Menghubungkan ke realtime room..." : "Memakai fallback lokal untuk test antar tab.");

    session.transport?.close?.();

    try {
      session.transport = hasSupabaseConfig()
        ? await createSupabaseTransport(session.room, handleRemoteMessage)
        : createLocalTransport(session.room, handleRemoteMessage);
      session.connected = true;
    } catch (error) {
      session.active = false;
      setStatus("Connection failed");
      setNote(`Realtime gagal tersambung: ${error.message || "cek Supabase URL/key"}.`);
      return;
    }

    session.copyButton.disabled = false;
    session.panel?.classList.add("is-playing");
    setNote(role === "host"
      ? `Room ${session.room} siap. Kirim kode/link ke lawan.`
      : `Join room ${session.room}. Menunggu sinkronisasi dari host.`);

    startGameAsOnlinePlayer();

    if (role === "guest") {
      sendMessage("hello", { room: session.room });
    } else {
      setTimeout(() => sendCurrentSnapshot("host-ready"), 1400);
    }
  }

  async function createSupabaseTransport(room, onMessage) {
    const client = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);
    const channel = client.channel(`${ROOM_PREFIX}-${room}`, {
      config: {
        broadcast: { self: false, ack: true },
        presence: { key: clientId },
        private: false,
      },
    });

    channel.on("broadcast", { event: "game" }, ({ payload }) => onMessage(payload));
    channel.on("presence", { event: "sync" }, () => {
      if (session.role === "host") sendCurrentSnapshot("presence-sync");
    });

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("timeout subscribe realtime")), 12000);
      channel.subscribe((state) => {
        if (state === "SUBSCRIBED") {
          clearTimeout(timeout);
          resolve();
        }
        if (state === "CHANNEL_ERROR" || state === "TIMED_OUT" || state === "CLOSED") {
          clearTimeout(timeout);
          reject(new Error(state.toLowerCase().replace("_", " ")));
        }
      });
    });

    await channel.track({ clientId, room, player: session.player, at: Date.now() });

    return {
      send(payload) {
        const sendResult = channel.send({ type: "broadcast", event: "game", payload });
        if (sendResult && typeof sendResult.catch === "function") {
          sendResult.catch(() => setStatus("Realtime retrying"));
        }
      },
      close() {
        channel.unsubscribe();
        client.removeChannel(channel);
      },
    };
  }

  function createLocalTransport(room, onMessage) {
    const channel = new BroadcastChannel(`${LOCAL_EVENT}-${room}`);
    channel.onmessage = ({ data }) => onMessage(data);
    return {
      send(payload) {
        channel.postMessage(payload);
      },
      close() {
        channel.close();
      },
    };
  }

  function startGameAsOnlinePlayer() {
    waitForGame(() => {
      window.projectInfo.mode = 2;
      window.projectInfo.levelName = "online_room";
      window.projectInfo.tutorial = false;
      window.projectInfo.clickedHelpButton = false;
      window.projectInfo.lastBreaker = "p2";
      session.started = true;
      window.game.state.start("play");
    });
  }

  function waitForGame(callback) {
    const timer = setInterval(() => {
      const assetsReady = window.game?.cache?.checkImageKey?.("tableTop");
      if (window.game && window.projectInfo && window.Phaser && window.playState && assetsReady) {
        clearInterval(timer);
        callback();
      }
    }, 100);
  }

  function guardInputForTurn() {
    if (!session.active || !session.started) return;

    const gi = getGameInfo();
    if (!gi || !gi.ballArray || gi.gameOver) return;

    const localTurn = gi.turn === session.player;
    document.body.classList.toggle("remote-turn", !localTurn);

    if (localTurn) return;

    gi.preventAim = true;
    gi.preventSetPower = true;
    gi.preventUpdateCue = true;
    gi.settingPower = false;
    gi.beginStrike = false;
    gi.startAim = false;
    if (gi.spinSetterZoom) gi.spinSetterZoom.visible = false;
  }

  function syncLoop() {
    if (!session.active || !session.started || !session.connected) return;

    const gi = getGameInfo();
    if (!gi || !gi.ballArray) return;

    const localTurn = gi.turn === session.player;
    const shouldSend = localTurn || gi.shotRunning || session.role === "host";
    if (!shouldSend || Date.now() - session.lastAppliedAt < 450) return;

    const snapshot = makeSnapshot(gi);
    const key = snapshotKey(snapshot);
    if (key === session.lastSentKey) return;

    session.lastSentKey = key;
    sendMessage("snapshot", { snapshot });
  }

  function handleRemoteMessage(message) {
    if (!message || message.clientId === clientId || message.room !== session.room) return;
    const lastSequence = session.lastRemoteByClient.get(message.clientId) || 0;
    if (message.sequence <= lastSequence) return;
    session.lastRemoteByClient.set(message.clientId, message.sequence);
    session.lastRemoteAt = Date.now();

    if (message.type === "hello" && session.role === "host") {
      sendCurrentSnapshot("hello-reply");
      return;
    }

    if (message.type === "snapshot" && message.snapshot) {
      applySnapshot(message.snapshot);
      setStatus(`${session.role === "host" ? "Host" : "Guest"} ${session.room} synced`);
    }
  }

  function sendCurrentSnapshot(reason) {
    const gi = getGameInfo();
    if (!gi) return;
    sendMessage("snapshot", { reason, snapshot: makeSnapshot(gi) });
  }

  function sendMessage(type, payload = {}) {
    if (!session.transport) return;
    session.sequence += 1;
    session.transport.send({
      ...payload,
      type,
      room: session.room,
      player: session.player,
      role: session.role,
      clientId,
      sequence: session.sequence,
      sentAt: Date.now(),
    });
  }

  function makeSnapshot(gi) {
    return {
      turn: gi.turn,
      shotNum: gi.shotNum,
      shotRunning: Boolean(gi.shotRunning),
      shotReset: Boolean(gi.shotReset),
      cueBallInHand: Boolean(gi.cueBallInHand),
      p1TargetType: gi.p1TargetType,
      p2TargetType: gi.p2TargetType,
      p1Rack: gi.p1Rack,
      p2Rack: gi.p2Rack,
      ballsRemaining: gi.ballsRemaining,
      pottedBallArray: Array.isArray(gi.pottedBallArray) ? [...gi.pottedBallArray] : [],
      gameOver: Boolean(gi.gameOver),
      winner: gi.winner || "",
      foulDisplayComplete: Boolean(gi.foulDisplayComplete),
      balls: gi.ballArray.map((ball) => ({
        id: ball.id,
        active: Boolean(ball.active),
        position: packVector(ball.position),
        velocity: packVector(ball.velocity),
        screw: ball.screw || 0,
        english: ball.english || 0,
        ySpin: ball.ySpin || 0,
        pocketTweenComplete: ball.pocketTweenComplete !== false,
      })),
    };
  }

  function applySnapshot(snapshot) {
    const gi = getGameInfo();
    if (!gi || !gi.ballArray || session.applying) return;

    session.applying = true;
    session.lastAppliedAt = Date.now();

    gi.turn = snapshot.turn || gi.turn;
    gi.shotNum = snapshot.shotNum ?? gi.shotNum;
    gi.shotRunning = Boolean(snapshot.shotRunning);
    gi.shotReset = Boolean(snapshot.shotReset);
    gi.cueBallInHand = Boolean(snapshot.cueBallInHand);
    gi.p1TargetType = snapshot.p1TargetType || gi.p1TargetType;
    gi.p2TargetType = snapshot.p2TargetType || gi.p2TargetType;
    gi.p1Rack = snapshot.p1Rack || gi.p1Rack;
    gi.p2Rack = snapshot.p2Rack || gi.p2Rack;
    gi.ballsRemaining = snapshot.ballsRemaining ?? gi.ballsRemaining;
    gi.pottedBallArray = Array.isArray(snapshot.pottedBallArray) ? [...snapshot.pottedBallArray] : gi.pottedBallArray;
    gi.gameOver = Boolean(snapshot.gameOver);
    gi.winner = snapshot.winner || gi.winner;
    gi.foulDisplayComplete = snapshot.foulDisplayComplete ?? gi.foulDisplayComplete;

    snapshot.balls?.forEach((next) => {
      const ball = gi.ballArray.find((entry) => entry.id === next.id);
      if (!ball) return;

      ball.active = Boolean(next.active);
      ball.position = new window.Vector2D(next.position.x, next.position.y);
      ball.velocity = new window.Vector2D(next.velocity.x, next.velocity.y);
      ball.screw = next.screw || 0;
      ball.english = next.english || 0;
      ball.ySpin = next.ySpin || 0;
      ball.pocketTweenComplete = next.pocketTweenComplete !== false;

      const visible = ball.active || ball.id === 0;
      if (ball.mc) ball.mc.visible = visible;
      if (ball.shadow) ball.shadow.visible = visible;
      if (ball.mover) ball.mover.visible = false;
      if (ball.marker) ball.marker.visible = false;
    });

    syncGameChrome(gi);
    guardInputForTurn();

    try {
      window.renderScreen?.();
    } finally {
      session.applying = false;
    }
  }

  function syncGameChrome(gi) {
    if (gi.turnArrow1 && gi.turnArrow2) {
      gi.turnArrow1.frame = gi.turn === "p1" ? 1 : 0;
      gi.turnArrow2.frame = gi.turn === "p2" ? 1 : 0;
    }

    if (gi.rackSpotNumberArray && Array.isArray(gi.pottedBallArray)) {
      gi.pottedBallArray.forEach((ballId) => {
        if (gi.rackSpotNumberArray[ballId]) gi.rackSpotNumberArray[ballId].visible = false;
      });
    }

    if (gi.rackSolids8ball && gi.rackStripes8ball) {
      gi.rackSolids8ball.visible =
        (gi.p1TargetType === "8 BALL" && gi.p1Rack === "solids") ||
        (gi.p2TargetType === "8 BALL" && gi.p2Rack === "solids");
      gi.rackStripes8ball.visible =
        (gi.p1TargetType === "8 BALL" && gi.p1Rack === "stripes") ||
        (gi.p2TargetType === "8 BALL" && gi.p2Rack === "stripes");
    }
  }

  function getGameInfo() {
    return window.playState && window.playState.gameInfo ? window.playState.gameInfo : null;
  }

  function packVector(vector) {
    return {
      x: round(vector?.x),
      y: round(vector?.y),
    };
  }

  function snapshotKey(snapshot) {
    return JSON.stringify({
      turn: snapshot.turn,
      shotNum: snapshot.shotNum,
      shotRunning: snapshot.shotRunning,
      cueBallInHand: snapshot.cueBallInHand,
      p1TargetType: snapshot.p1TargetType,
      p2TargetType: snapshot.p2TargetType,
      gameOver: snapshot.gameOver,
      winner: snapshot.winner,
      balls: snapshot.balls.map((ball) => [
        ball.id,
        ball.active ? 1 : 0,
        Math.round(ball.position.x / 12),
        Math.round(ball.position.y / 12),
        Math.round(ball.velocity.x / 12),
        Math.round(ball.velocity.y / 12),
      ]),
    });
  }

  function hasSupabaseConfig() {
    return Boolean(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey && window.supabase?.createClient);
  }

  function getRoomFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return cleanRoomCode(params.get("room") || "");
  }

  function updateRoomUrl(room) {
    const url = new URL(window.location.href);
    url.searchParams.set("room", cleanRoomCode(room));
    window.history.replaceState({}, "", url);
  }

  async function copyRoomLink() {
    if (!session.room) return;
    const url = new URL(window.location.href);
    url.searchParams.set("room", session.room);
    const link = url.toString();
    try {
      await navigator.clipboard.writeText(link);
      setNote(`Link room ${session.room} tersalin.`);
    } catch {
      session.roomInput.value = session.room;
      session.roomInput.select();
      setNote(`Copy manual link ini: ${link}`);
    }
  }

  function setStatus(text) {
    if (session.statusEl) session.statusEl.textContent = text;
  }

  function setNote(text) {
    if (session.noteEl) session.noteEl.textContent = text;
  }

  function cleanRoomCode(value) {
    return String(value || "").replace(/[^a-z0-9]/gi, "").slice(0, 8).toUpperCase();
  }

  function createRuntimeId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }

  function makeRoomCode() {
    return Math.random().toString(36).slice(2, 6).toUpperCase();
  }

  function round(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
  }
})();
