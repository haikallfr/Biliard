import { useEffect, useMemo, useRef, useState } from "react";
import { createGameEngine } from "../game/engine";
import { TABLE } from "../game/constants";
import { drawTable } from "../game/render";

export default function GameCanvas({ onPocket, onShot, remoteShot, remoteSnapshot, active, turnToken }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const gameRef = useRef(null);
  const shotRef = useRef(null);
  const aimRef = useRef(null);
  const activeRef = useRef(active);
  const spinRef = useRef({ x: 0, y: 0 });
  const powerRef = useRef(0);
  const onPocketRef = useRef(onPocket);
  const onShotRef = useRef(onShot);
  const lastResolvedShotRef = useRef(null);
  const rulesSignatureRef = useRef("");
  const [aim, setAim] = useState(null);
  const [spin, setSpin] = useState({ x: 0, y: 0 });
  const [shotPower, setShotPower] = useState(0);
  const [charging, setCharging] = useState(false);
  const [ready, setReady] = useState(false);
  const [rules, setRules] = useState(null);
  const resources = useMemo(() => ({ feltPattern: null }), []);

  useEffect(() => {
    aimRef.current = aim;
  }, [aim]);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    spinRef.current = spin;
    if (aimRef.current) {
      const nextAim = { ...aimRef.current, spin };
      aimRef.current = nextAim;
      setAim(nextAim);
    }
  }, [spin]);

  useEffect(() => {
    powerRef.current = shotPower;
    if (aimRef.current) {
      const nextAim = { ...aimRef.current, power: shotPower };
      aimRef.current = nextAim;
      setAim(nextAim);
    }
  }, [shotPower]);

  useEffect(() => {
    onPocketRef.current = onPocket;
  }, [onPocket]);

  useEffect(() => {
    onShotRef.current = onShot;
  }, [onShot]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const image = new Image();
    image.src = "/assets/felt-texture.png";
    image.onload = () => {
      resources.feltPattern = ctx.createPattern(image, "repeat");
    };

    const game = createGameEngine((ball) => {
      onPocketRef.current?.(ball);
    });
    gameRef.current = game;
    setRules(game.gameState());
    setReady(true);

    let frame = 0;
    let last = performance.now();
    const tick = (now) => {
      const delta = Math.min(now - last, 1000 / 60);
      last = now;
      game.step(delta);
      const nextRules = game.gameState();
      const signature = rulesSignature(nextRules);
      if (signature !== rulesSignatureRef.current) {
        rulesSignatureRef.current = signature;
        setRules(nextRules);
      }

      if (nextRules.lastShot?.id && nextRules.lastShot.id !== lastResolvedShotRef.current) {
        lastResolvedShotRef.current = nextRules.lastShot.id;
        if (nextRules.ballInHand) {
          game.replaceCue();
        }
        onShotRef.current?.({
          type: "result",
          result: nextRules.lastShot,
          rules: game.gameState(),
          snapshot: game.snapshot(),
        });
      }

      const liveAim = getDrawableAim(game);
      drawTable(ctx, game, { aim: liveAim }, resources);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [resources]);

  useEffect(() => {
    if (!remoteShot || !gameRef.current) return;
    gameRef.current.shoot(remoteShot);
    lastResolvedShotRef.current = remoteShot.shotId ?? remoteShot.id ?? null;
  }, [remoteShot]);

  useEffect(() => {
    if (!remoteSnapshot || !gameRef.current) return;
    gameRef.current.setSnapshot(remoteSnapshot);
    const nextRules = gameRef.current.gameState();
    rulesSignatureRef.current = rulesSignature(nextRules);
    setRules(nextRules);
  }, [remoteSnapshot]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!gameRef.current?.allSleeping()) return;
      onShot?.({ type: "snapshot", snapshot: gameRef.current.snapshot() });
    }, 4500);

    return () => window.clearInterval(interval);
  }, [onShot]);

  function pointerToTable(event) {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * TABLE.width,
      y: ((event.clientY - rect.top) / rect.height) * TABLE.height,
    };
  }

  function startAim(event) {
    if (!canAim()) return;
    const nextAim = makeAim(pointerToTable(event), spinRef.current, powerRef.current);
    aimRef.current = nextAim;
    shotRef.current = nextAim;
    setAim(nextAim);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function moveAim(event) {
    if (!canAim()) return;
    const nextAim = makeAim(pointerToTable(event), spinRef.current, powerRef.current);
    aimRef.current = nextAim;
    shotRef.current = nextAim;
    setAim(nextAim);
  }

  function startPower(event) {
    if (!canAim()) return;
    setCharging(true);
    updatePower(event);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function movePower(event) {
    if (!charging) return;
    updatePower(event);
  }

  function endPower(event) {
    if (!charging) return;
    const power = updatePower(event);
    setCharging(false);
    fireShot(power);
  }

  function updatePower(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const value = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    const nextPower = Number(value.toFixed(3));
    powerRef.current = nextPower;
    setShotPower(nextPower);
    if (aimRef.current) {
      const nextAim = { ...aimRef.current, power: nextPower };
      aimRef.current = nextAim;
      setAim(nextAim);
    }
    return nextPower;
  }

  function fireShot(power) {
    if (!canAim() || !gameRef.current) return;
    const cue = gameRef.current.cueBall();
    const currentAim = aimRef.current ?? defaultAim(gameRef.current, spinRef.current, power);
    if (!cue || !currentAim) return;

    const shot = {
      id: "cue",
      angle: currentAim.angle,
      power: Math.max(0.08, power),
      spin: spinRef.current,
      turnToken,
      shotId: `${turnToken}-${Date.now()}`,
    };

    const acceptedShot = gameRef.current.shoot(shot);
    if (acceptedShot) {
      onShot?.({ type: "shot", shot: acceptedShot, snapshot: gameRef.current.snapshot() });
    }
    powerRef.current = 0;
    setShotPower(0);
  }

  function resetGame() {
    gameRef.current?.reset();
    lastResolvedShotRef.current = null;
    const nextRules = gameRef.current?.gameState() ?? null;
    rulesSignatureRef.current = nextRules ? rulesSignature(nextRules) : "";
    setRules(nextRules);
    onShot?.({ type: "snapshot", snapshot: gameRef.current.snapshot() });
  }

  function canAim() {
    const game = gameRef.current;
    const cue = game?.cueBall();
    return Boolean(activeRef.current && ready && game?.allSleeping() && cue && !cue.plugin.pocketed);
  }

  function makeAim(point, nextSpin = spin, nextPower = shotPower) {
    const cue = gameRef.current?.cueBall();
    if (!cue) return { point, angle: 0, power: nextPower, spin: nextSpin };
    return {
      point,
      angle: Math.atan2(point.y - cue.position.y, point.x - cue.position.x),
      power: nextPower,
      spin: nextSpin,
    };
  }

  function defaultAim(game, nextSpin = spinRef.current, nextPower = powerRef.current) {
    const cue = game?.cueBall();
    if (!cue || cue.plugin.pocketed) return null;
    const point = aimRef.current?.point ?? {
      x: Math.min(TABLE.width - TABLE.rail * 2, cue.position.x + 260),
      y: cue.position.y,
    };
    return makeAim(point, nextSpin, nextPower);
  }

  function getDrawableAim(game) {
    if (!activeRef.current || !game?.allSleeping()) return null;
    return aimRef.current ?? defaultAim(game);
  }

  function updateSpin(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    const nextSpin = {
      x: Math.max(-1, Math.min(1, x)),
      y: Math.max(-1, Math.min(1, y)),
    };
    setSpin(nextSpin);
  }

  const power = shotPower;
  const status = rules?.winner !== null && rules?.winner !== undefined
    ? `Pemain ${rules.winner + 1} menang`
    : rules?.ballInHand
      ? "Ball in hand"
      : active
        ? "Giliran kamu"
        : "Menunggu lawan";

  return (
    <div className="table-shell" ref={wrapRef}>
      <div className="playfield">
        <canvas
          ref={canvasRef}
          width={TABLE.width}
          height={TABLE.height}
          className="pool-canvas"
          onPointerDown={startAim}
          onPointerMove={moveAim}
        />
        <div className={`shot-hud ${charging ? "active" : ""}`} aria-label="Shot power">
          <div
            className="power-meter"
            onPointerDown={startPower}
            onPointerMove={movePower}
            onPointerUp={endPower}
            onPointerCancel={() => {
              setCharging(false);
              setShotPower(0);
              powerRef.current = 0;
            }}
          >
          <b style={{ top: `${Math.max(5, Math.min(95, power * 100))}%` }} />
          <span style={{ transform: `scaleY(${Math.max(0.04, power)})` }} />
          </div>
        </div>
      </div>
      <div className="table-actions">
        <button type="button" onClick={resetGame}>Rack ulang</button>
        <div
          className="spin-pad"
          aria-label="Cue spin"
          onPointerDown={updateSpin}
          onPointerMove={(event) => {
            if (event.buttons === 1) updateSpin(event);
          }}
        >
          <span
            style={{
              left: `${50 + spin.x * 38}%`,
              top: `${50 - spin.y * 38}%`,
            }}
          />
        </div>
        <span>{status}</span>
      </div>
    </div>
  );
}

function rulesSignature(rules) {
  return [
    rules.phase,
    rules.currentPlayer,
    rules.groups?.[0] ?? "open",
    rules.groups?.[1] ?? "open",
    rules.ballInHand ? "hand" : "table",
    rules.foul ?? "clean",
    rules.winner ?? "none",
    rules.lastShot?.id ?? "none",
  ].join("|");
}
