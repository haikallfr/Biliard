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
  const onPocketRef = useRef(onPocket);
  const [aim, setAim] = useState(null);
  const [ready, setReady] = useState(false);
  const resources = useMemo(() => ({ feltPattern: null }), []);

  useEffect(() => {
    aimRef.current = aim;
  }, [aim]);

  useEffect(() => {
    onPocketRef.current = onPocket;
  }, [onPocket]);

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
      if (ball?.id === "cue") {
        window.setTimeout(() => game.replaceCue(), 700);
      }
    });
    gameRef.current = game;
    setReady(true);

    let frame = 0;
    let last = performance.now();
    const tick = (now) => {
      const delta = Math.min(now - last, 1000 / 60);
      last = now;
      game.step(delta);
      drawTable(ctx, game, { aim: aimRef.current }, resources);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [resources]);

  useEffect(() => {
    if (!remoteShot || !gameRef.current) return;
    gameRef.current.shoot(remoteShot);
  }, [remoteShot]);

  useEffect(() => {
    if (!remoteSnapshot || !gameRef.current) return;
    gameRef.current.setSnapshot(remoteSnapshot);
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
    if (!active || !ready || !gameRef.current?.allSleeping()) return;
    const cue = gameRef.current.cueBall();
    if (!cue || cue.plugin.pocketed) return;
    const point = pointerToTable(event);
    const distance = Math.hypot(point.x - cue.position.x, point.y - cue.position.y);
    if (distance > 95) return;
    shotRef.current = point;
    setAim(point);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function moveAim(event) {
    if (!shotRef.current) return;
    const point = pointerToTable(event);
    shotRef.current = point;
    setAim(point);
  }

  function endAim() {
    if (!shotRef.current || !gameRef.current) return;
    const cue = gameRef.current.cueBall();
    const point = shotRef.current;
    const dx = point.x - cue.position.x;
    const dy = point.y - cue.position.y;
    const pull = Math.min(Math.hypot(dx, dy), 190);
    const shot = {
      id: "cue",
      angle: Math.atan2(dy, dx) + Math.PI,
      power: Math.max(0.08, pull / 190),
      turnToken,
    };

    gameRef.current.shoot(shot);
    onShot?.({ type: "shot", shot, snapshot: gameRef.current.snapshot() });
    shotRef.current = null;
    setAim(null);
  }

  function resetGame() {
    gameRef.current?.reset();
    onShot?.({ type: "snapshot", snapshot: gameRef.current.snapshot() });
  }

  return (
    <div className="table-shell" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        width={TABLE.width}
        height={TABLE.height}
        className="pool-canvas"
        onPointerDown={startAim}
        onPointerMove={moveAim}
        onPointerUp={endAim}
        onPointerCancel={endAim}
      />
      <div className="table-actions">
        <button type="button" onClick={resetGame}>Rack ulang</button>
        <span>{active ? "Giliran kamu" : "Menunggu lawan"}</span>
      </div>
    </div>
  );
}
