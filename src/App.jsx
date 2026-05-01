import { CircleDot, Copy, Link2, RotateCcw, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import GameCanvas from "./components/GameCanvas";
import { makeRoomCode, createRealtimeRoom } from "./multiplayer/realtime";

const playerId = crypto.randomUUID();

export default function App() {
  const [roomCode, setRoomCode] = useState(() => makeRoomCode());
  const [joinInput, setJoinInput] = useState("");
  const [transport, setTransport] = useState("local");
  const [onlineCount, setOnlineCount] = useState(1);
  const [remoteShot, setRemoteShot] = useState(null);
  const [remoteSnapshot, setRemoteSnapshot] = useState(null);
  const [turn, setTurn] = useState(0);
  const [groups, setGroups] = useState({ 0: null, 1: null });
  const [pocketed, setPocketed] = useState([]);
  const [message, setMessage] = useState("Tarik bola putih untuk mengatur arah dan tenaga.");
  const roomRef = useRef(null);

  const currentPlayer = turn % 2;
  const myPlayer = 0;
  const isMyTurn = currentPlayer === myPlayer;
  const canPlay = transport === "local" || onlineCount < 2 || isMyTurn;

  useEffect(() => {
    roomRef.current?.close();
    roomRef.current = createRealtimeRoom(roomCode, playerId, {
      onReady: setTransport,
      onPresence: setOnlineCount,
      onShot: (payload) => {
        setRemoteShot({ ...payload.shot, nonce: crypto.randomUUID() });
        setTurn((value) => value + 1);
        setMessage("Lawan baru saja menembak. Tunggu bola berhenti.");
      },
      onSnapshot: (payload) => {
        setRemoteSnapshot({ ...payload.snapshot, nonce: crypto.randomUUID() });
      },
    });

    return () => roomRef.current?.close();
  }, [roomCode]);

  const scoreboard = useMemo(() => {
    const playerPocketed = pocketed.filter((ball) => ball.owner === 0);
    const opponentPocketed = pocketed.filter((ball) => ball.owner === 1);
    return [
      { label: "Kamu", group: groups[0] ?? "open", count: playerPocketed.length },
      { label: "Lawan", group: groups[1] ?? "open", count: opponentPocketed.length },
    ];
  }, [groups, pocketed]);

  function joinRoom(event) {
    event.preventDefault();
    const nextRoom = joinInput.trim().toUpperCase().slice(0, 8);
    if (!nextRoom) return;
    setRoomCode(nextRoom);
    setJoinInput("");
    setMessage(`Masuk room ${nextRoom}. Bagikan kode ini ke lawan.`);
  }

  async function copyRoom() {
    await navigator.clipboard?.writeText(roomCode);
    setMessage(`Kode room ${roomCode} disalin.`);
  }

  function handlePocket(ball) {
    if (!ball) return;
    if (ball.type === "cue") {
      setMessage("Foul: bola putih masuk. Bola dikembalikan ke baulk.");
      setTurn((value) => value + 1);
      return;
    }

    if (ball.type === "eight") {
      setMessage(`${currentPlayer === myPlayer ? "Kamu" : "Lawan"} memasukkan bola 8. Rack selesai.`);
      setPocketed((items) => [...items, { ...ball, owner: currentPlayer }]);
      return;
    }

    setPocketed((items) => [...items, { ...ball, owner: currentPlayer }]);
    setGroups((prev) => {
      if (prev[0] || prev[1]) return prev;
      const other = currentPlayer === 0 ? 1 : 0;
      const otherGroup = ball.type === "solid" ? "stripe" : "solid";
      return { ...prev, [currentPlayer]: ball.type, [other]: otherGroup };
    });
    setMessage(`${ball.type === "solid" ? "Solid" : "Stripe"} masuk. Pemain tetap pegang meja.`);
  }

  function handleShot(event) {
    if (event.type === "shot") {
      roomRef.current?.sendShot({ shot: event.shot });
      setTurn((value) => value + 1);
      setMessage("Shot terkirim. Fisika disinkronkan ke room.");
    }

    if (event.type === "snapshot") {
      roomRef.current?.sendSnapshot({ snapshot: event.snapshot });
    }
  }

  function newRoom() {
    const next = makeRoomCode();
    setRoomCode(next);
    setPocketed([]);
    setGroups({ 0: null, 1: null });
    setTurn(0);
    setMessage(`Room baru ${next} siap dimainkan.`);
  }

  return (
    <main className="app-shell">
      <section className="topbar" aria-label="Game controls">
        <div className="brand">
          <span className="brand-mark"><CircleDot size={20} /></span>
          <div>
            <h1>BreakRoom 8</h1>
            <p>8-ball pool realtime untuk web</p>
          </div>
        </div>

        <form className="room-form" onSubmit={joinRoom}>
          <label htmlFor="room-code">Room</label>
          <input
            id="room-code"
            value={joinInput}
            onChange={(event) => setJoinInput(event.target.value)}
            placeholder={roomCode}
            maxLength={8}
          />
          <button type="submit"><Link2 size={16} /> Join</button>
        </form>

        <div className="room-chip">
          <span>{roomCode}</span>
          <button type="button" onClick={copyRoom} aria-label="Salin kode room"><Copy size={16} /></button>
        </div>
      </section>

      <section className="game-layout">
        <aside className="side-panel">
          <div className="panel-block">
            <p className="eyeline">Room aktif</p>
            <div className="transport-row">
              <Users size={18} />
              <strong>{onlineCount}</strong>
              <span>{transport === "supabase" ? "Online realtime" : "Local tab demo"}</span>
            </div>
          </div>

          <div className="panel-block">
            <p className="eyeline">Giliran</p>
            <div className={`turn-card ${canPlay ? "active" : ""}`}>
              <span>Pemain {currentPlayer + 1}</span>
              <strong>{canPlay ? "Kamu" : "Lawan"}</strong>
            </div>
          </div>

          <div className="score-list">
            {scoreboard.map((player) => (
              <div className="score-row" key={player.label}>
                <span>{player.label}</span>
                <strong>{player.count}</strong>
                <small>{player.group}</small>
              </div>
            ))}
          </div>

          <button className="secondary-action" type="button" onClick={newRoom}>
            <RotateCcw size={16} />
            Room baru
          </button>
        </aside>

        <GameCanvas
          onPocket={handlePocket}
          onShot={handleShot}
          remoteShot={remoteShot}
          remoteSnapshot={remoteSnapshot}
          active={canPlay}
          turnToken={turn}
        />

        <aside className="side-panel compact">
          <div className="panel-block">
            <p className="eyeline">Status</p>
            <p className="message">{message}</p>
          </div>
          <div className="pocket-tray">
            {pocketed.length === 0 ? (
              <span>Belum ada bola masuk</span>
            ) : (
              pocketed.slice(-8).map((ball, index) => (
                <i key={`${ball.id}-${index}`} style={{ "--ball": ball.color }}>{ball.number}</i>
              ))
            )}
          </div>
        </aside>
      </section>

      <section className="mobile-hud">
        <span>{message}</span>
        <strong>{roomCode}</strong>
      </section>
    </main>
  );
}
