import { CircleDot, Copy, Link2, RotateCcw, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import GameCanvas from "./components/GameCanvas";
import { INITIAL_RULES } from "./game/constants";
import { makeRoomCode, createRealtimeRoom } from "./multiplayer/realtime";

const playerId = crypto.randomUUID();

export default function App() {
  const [roomCode, setRoomCode] = useState(() => makeRoomCode());
  const [joinInput, setJoinInput] = useState("");
  const [transport, setTransport] = useState("local");
  const [onlineCount, setOnlineCount] = useState(1);
  const [remoteShot, setRemoteShot] = useState(null);
  const [remoteSnapshot, setRemoteSnapshot] = useState(null);
  const [rules, setRules] = useState(INITIAL_RULES);
  const [pocketed, setPocketed] = useState([]);
  const [message, setMessage] = useState("Tarik bola putih untuk mengatur arah dan tenaga.");
  const roomRef = useRef(null);

  const currentPlayer = rules.currentPlayer;
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
        setMessage("Lawan baru saja menembak. Tunggu bola berhenti.");
      },
      onSnapshot: (payload) => {
        setRemoteSnapshot({ ...payload.snapshot, nonce: crypto.randomUUID() });
        if (payload.snapshot?.rules) {
          setRules(payload.snapshot.rules);
          setMessage(statusFromRules(payload.snapshot.rules, myPlayer));
        }
      },
    });

    return () => roomRef.current?.close();
  }, [roomCode]);

  const scoreboard = useMemo(() => {
    const playerPocketed = pocketed.filter((ball) => ball.owner === 0);
    const opponentPocketed = pocketed.filter((ball) => ball.owner === 1);
    return [
      { label: "Kamu", group: rules.groups[0] ?? "open", count: playerPocketed.length },
      { label: "Lawan", group: rules.groups[1] ?? "open", count: opponentPocketed.length },
    ];
  }, [rules.groups, pocketed]);

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
      setMessage("Scratch: bola putih masuk. Tunggu sampai semua bola berhenti.");
      return;
    }

    if (ball.type === "eight") {
      setMessage(`${currentPlayer === myPlayer ? "Kamu" : "Lawan"} memasukkan bola 8.`);
      setPocketed((items) => [...items, { ...ball, owner: currentPlayer }]);
      return;
    }

    setPocketed((items) => [...items, { ...ball, owner: currentPlayer }]);
    setMessage(`${ball.type === "solid" ? "Solid" : "Stripe"} masuk.`);
  }

  function handleShot(event) {
    if (event.type === "shot") {
      roomRef.current?.sendShot({ shot: event.shot });
      setMessage("Shot terkirim. Fisika sedang berjalan sinkron.");
    }

    if (event.type === "result") {
      setRules(event.rules);
      setMessage(statusFromRules(event.rules, myPlayer));
      roomRef.current?.sendSnapshot({ snapshot: event.snapshot });
    }

    if (event.type === "snapshot") {
      roomRef.current?.sendSnapshot({ snapshot: event.snapshot });
      if (event.snapshot?.rules) setRules(event.snapshot.rules);
    }
  }

  function newRoom() {
    const next = makeRoomCode();
    setRoomCode(next);
    setPocketed([]);
    setRules(INITIAL_RULES);
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
              <strong>{currentPlayer === myPlayer ? "Kamu" : "Lawan"}</strong>
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
          turnToken={rules.shotNumber}
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

function statusFromRules(rules, myPlayer) {
  if (rules.winner !== null && rules.winner !== undefined) {
    return rules.winner === myPlayer ? "Kamu menang. Bola 8 masuk legal." : "Lawan menang. Rack selesai.";
  }

  if (rules.foul) {
    return `Foul: ${foulText(rules.foul)}. Giliran Pemain ${rules.currentPlayer + 1}.`;
  }

  if (rules.lastShot?.pocketed?.length) {
    const names = rules.lastShot.pocketed.map((ball) => (ball.number ? ball.number : "cue")).join(", ");
    return `Bola masuk: ${names}. Giliran Pemain ${rules.currentPlayer + 1}.`;
  }

  return `Giliran Pemain ${rules.currentPlayer + 1}.`;
}

function foulText(foul) {
  const labels = {
    scratch: "scratch",
    noContact: "tidak kena bola",
    wrongFirstBall: "bola pertama salah",
    noRailAfterContact: "tidak ada rail setelah kontak",
    illegalBreak: "break tidak sah",
    eightFirstOnOpenTable: "bola 8 tidak boleh disentuh dulu",
  };

  return labels[foul] ?? foul;
}
