import Matter from "matter-js";
import { BALLS, POCKETS, TABLE } from "./constants";

const { Bodies, Body, Composite, Engine, Events, World } = Matter;

export function createGameEngine(onScore) {
  const engine = Engine.create({ gravity: { x: 0, y: 0 } });
  engine.positionIterations = 12;
  engine.velocityIterations = 10;

  const ballMap = new Map();
  const walls = makeWalls();

  World.add(engine.world, walls);
  createRack().forEach((ball) => {
    ballMap.set(ball.label, ball);
    World.add(engine.world, ball);
  });

  Events.on(engine, "collisionStart", (event) => {
    event.pairs.forEach(({ bodyA, bodyB }) => {
      if (bodyA.plugin?.kind === "ball") bodyA.plugin.lastContact = bodyB.label;
      if (bodyB.plugin?.kind === "ball") bodyB.plugin.lastContact = bodyA.label;
    });
  });

  function step(delta) {
    Engine.update(engine, delta);
    applyClothDrag();
    detectPockets(onScore);
  }

  function shoot({ id = "cue", angle, power }) {
    const ball = ballMap.get(id);
    if (!ball || ball.plugin.pocketed) return;

    const impulse = Math.min(Math.max(power, 0), 1) * 0.092;
    Body.applyForce(ball, ball.position, {
      x: Math.cos(angle) * impulse,
      y: Math.sin(angle) * impulse,
    });
  }

  function reset() {
    Composite.clear(engine.world, false);
    World.add(engine.world, walls);
    ballMap.clear();
    createRack().forEach((ball) => {
      ballMap.set(ball.label, ball);
      World.add(engine.world, ball);
    });
  }

  function setSnapshot(snapshot) {
    snapshot?.balls?.forEach((next) => {
      const ball = ballMap.get(next.id);
      if (!ball) return;
      ball.plugin.pocketed = next.pocketed;
      Body.setPosition(ball, next.position);
      Body.setVelocity(ball, next.velocity);
      Body.setAngularVelocity(ball, next.angularVelocity ?? 0);
      if (next.pocketed) World.remove(engine.world, ball);
      if (!next.pocketed && !Composite.get(engine.world, ball.id, "body")) {
        World.add(engine.world, ball);
      }
    });
  }

  function snapshot() {
    return {
      balls: getBalls().map((ball) => ({
        id: ball.label,
        position: { x: ball.position.x, y: ball.position.y },
        velocity: { x: ball.velocity.x, y: ball.velocity.y },
        angularVelocity: ball.angularVelocity,
        pocketed: Boolean(ball.plugin.pocketed),
      })),
    };
  }

  function getBalls() {
    return Array.from(ballMap.values());
  }

  function cueBall() {
    return ballMap.get("cue");
  }

  function allSleeping() {
    return getBalls()
      .filter((ball) => !ball.plugin.pocketed)
      .every((ball) => Math.hypot(ball.velocity.x, ball.velocity.y) < 0.055);
  }

  function replaceCue() {
    const cue = cueBall();
    if (!cue) return;
    cue.plugin.pocketed = false;
    Body.setPosition(cue, { x: TABLE.width * 0.26, y: TABLE.height / 2 });
    Body.setVelocity(cue, { x: 0, y: 0 });
    Body.setAngularVelocity(cue, 0);
    if (!Composite.get(engine.world, cue.id, "body")) World.add(engine.world, cue);
  }

  function applyClothDrag() {
    getBalls().forEach((ball) => {
      if (ball.plugin.pocketed) return;
      const speed = Math.hypot(ball.velocity.x, ball.velocity.y);
      if (speed < 0.045) {
        Body.setVelocity(ball, { x: 0, y: 0 });
        Body.setAngularVelocity(ball, 0);
        return;
      }

      Body.setVelocity(ball, {
        x: ball.velocity.x * 0.992,
        y: ball.velocity.y * 0.992,
      });
      Body.setAngularVelocity(ball, ball.angularVelocity * 0.992);
    });
  }

  function detectPockets(score) {
    getBalls().forEach((ball) => {
      if (ball.plugin.pocketed) return;
      const sunk = POCKETS.some(
        (pocket) => Math.hypot(ball.position.x - pocket.x, ball.position.y - pocket.y) < TABLE.pocketRadius,
      );
      if (!sunk) return;

      ball.plugin.pocketed = true;
      World.remove(engine.world, ball);
      score?.(BALLS.find((candidate) => candidate.id === ball.label));
    });
  }

  return {
    engine,
    shoot,
    reset,
    step,
    getBalls,
    allSleeping,
    cueBall,
    snapshot,
    setSnapshot,
    replaceCue,
  };
}

function makeWalls() {
  const rail = TABLE.rail;
  const wallOptions = {
    isStatic: true,
    restitution: 0.92,
    friction: 0,
    render: { visible: false },
  };

  return [
    Bodies.rectangle(TABLE.width / 2, rail * 0.42, TABLE.width - rail * 2.2, rail * 0.46, wallOptions),
    Bodies.rectangle(TABLE.width / 2, TABLE.height - rail * 0.42, TABLE.width - rail * 2.2, rail * 0.46, wallOptions),
    Bodies.rectangle(rail * 0.42, TABLE.height / 2, rail * 0.46, TABLE.height - rail * 2.2, wallOptions),
    Bodies.rectangle(TABLE.width - rail * 0.42, TABLE.height / 2, rail * 0.46, TABLE.height - rail * 2.2, wallOptions),
  ];
}

function createRack() {
  const startX = TABLE.width * 0.69;
  const startY = TABLE.height / 2;
  const gap = TABLE.ballRadius * 2.08;
  const order = [1, 9, 2, 10, 8, 3, 11, 4, 12, 5, 13, 6, 14, 7, 15];
  const balls = [
    makeBall(BALLS[0], TABLE.width * 0.26, TABLE.height / 2),
  ];

  let index = 0;
  for (let column = 0; column < 5; column += 1) {
    for (let row = 0; row <= column; row += 1) {
      const number = order[index];
      const data = BALLS.find((ball) => ball.number === number);
      const x = startX + column * gap;
      const y = startY + (row - column / 2) * gap;
      balls.push(makeBall(data, x, y));
      index += 1;
    }
  }

  return balls;
}

function makeBall(data, x, y) {
  return Bodies.circle(x, y, TABLE.ballRadius, {
    label: data.id,
    restitution: 0.94,
    friction: 0.004,
    frictionAir: 0.003,
    slop: 0,
    density: 0.0024,
    plugin: {
      kind: "ball",
      number: data.number,
      color: data.color,
      type: data.type,
      pocketed: false,
      lastContact: null,
    },
  });
}
