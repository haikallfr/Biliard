import { BALLS, FOULS, GAME_PHASES, INITIAL_RULES, POCKETS, TABLE } from "./constants";

const FIXED_STEP_MS = 1000 / 120;
const FIXED_DT = FIXED_STEP_MS / 1000;
const MAX_FRAME_MS = 1000 / 20;
const MAX_CATCH_UP_STEPS = 8;

const PHYSICS = {
  ballMass: 1,
  ballRestitution: 0.985,
  ballFriction: 0.024,
  cushionRestitution: 0.83,
  cushionFriction: 0.075,
  rollingResistance: 185,
  airDragPerSecond: 0.33,
  spinDecayPerSecond: 1.35,
  sideSpinGrip: 34,
  topSpinGrip: 56,
  railEnglishGrip: 105,
  maxShotSpeed: 2320,
  minShotSpeed: 170,
  sleepSpeed: 7.5,
  sleepAngularSpeed: 0.035,
  pocketFalloff: 0.92,
  collisionIterations: 3,
};

const BALL_DIAMETER = TABLE.ballRadius * 2;
const FIELD = {
  left: TABLE.rail + TABLE.ballRadius,
  right: TABLE.width - TABLE.rail - TABLE.ballRadius,
  top: TABLE.rail + TABLE.ballRadius,
  bottom: TABLE.height - TABLE.rail - TABLE.ballRadius,
};

export function createGameEngine(onPocket) {
  const ballMap = new Map();
  const engine = {
    timing: { timestamp: 0 },
    world: { bodies: [] },
    physicsVersion: "custom-8ball-v1",
  };

  let accumulator = 0;
  let currentShot = null;
  let rules = cloneRules(INITIAL_RULES);

  rackBalls();

  function step(delta = FIXED_STEP_MS) {
    if (rules.phase === GAME_PHASES.ENDED) return;

    const frameDelta = clamp(delta, 0, MAX_FRAME_MS);
    accumulator += frameDelta;

    let steps = 0;
    while (accumulator >= FIXED_STEP_MS && steps < MAX_CATCH_UP_STEPS) {
      fixedStep(FIXED_DT);
      accumulator -= FIXED_STEP_MS;
      steps += 1;
    }

    if (steps === MAX_CATCH_UP_STEPS) {
      accumulator = 0;
    }

    if (currentShot && allSleeping()) {
      finalizeShot();
    }
  }

  function shoot({ id = "cue", angle, power, spin = {}, turnToken, shotId } = {}) {
    if (rules.phase === GAME_PHASES.ENDED || currentShot || !allSleeping()) return null;

    const ball = ballMap.get(id);
    if (!ball || ball.plugin.pocketed) return null;

    const normalizedShot = normalizeShot({
      id,
      angle,
      power,
      spin,
      turnToken,
      shotId: shotId ?? `${rules.currentPlayer}-${rules.shotNumber + 1}`,
    });

    const speed = lerp(PHYSICS.minShotSpeed, PHYSICS.maxShotSpeed, normalizedShot.power);
    Body.setVelocity(ball, {
      x: Math.cos(normalizedShot.angle) * speed,
      y: Math.sin(normalizedShot.angle) * speed,
    });
    Body.setAngularVelocity(ball, speed / TABLE.ballRadius);
    ball.spin.x = normalizedShot.spin.x;
    ball.spin.y = normalizedShot.spin.y;
    ball.plugin.lastContact = null;

    rules = {
      ...rules,
      foul: null,
      ballInHand: false,
      shotNumber: rules.shotNumber + 1,
    };

    currentShot = {
      id: normalizedShot.shotId,
      player: rules.currentPlayer,
      turnToken: normalizedShot.turnToken,
      command: normalizedShot,
      firstContact: null,
      pocketed: [],
      cuePocketed: false,
      railContacts: new Set(),
      railAfterContact: false,
      startedInPhase: rules.phase,
    };

    return normalizedShot;
  }

  function reset() {
    accumulator = 0;
    currentShot = null;
    rules = cloneRules(INITIAL_RULES);
    rackBalls();
  }

  function setSnapshot(snapshot) {
    if (!snapshot) return;

    snapshot.balls?.forEach((next) => {
      const ball = ballMap.get(next.id);
      if (!ball) return;

      ball.plugin.pocketed = Boolean(next.pocketed);
      Body.setPosition(ball, next.position ?? ball.position);
      Body.setVelocity(ball, next.velocity ?? { x: 0, y: 0 });
      Body.setAngularVelocity(ball, next.angularVelocity ?? 0);
      ball.angle = next.angle ?? ball.angle ?? 0;
      ball.spin = {
        x: next.spin?.x ?? 0,
        y: next.spin?.y ?? 0,
      };
      ball.plugin.lastContact = next.lastContact ?? null;
    });

    if (snapshot.rules) {
      rules = normalizeRules(snapshot.rules);
    }

    accumulator = 0;
    currentShot = null;
    syncWorldBodies();
  }

  function snapshot() {
    return {
      physicsVersion: engine.physicsVersion,
      timestamp: round(engine.timing.timestamp),
      rules: cloneRules(rules),
      shot: currentShot
        ? {
            id: currentShot.id,
            player: currentShot.player,
            turnToken: currentShot.turnToken,
            command: currentShot.command,
            firstContact: currentShot.firstContact,
            pocketed: currentShot.pocketed,
            cuePocketed: currentShot.cuePocketed,
            railContacts: Array.from(currentShot.railContacts),
            railAfterContact: currentShot.railAfterContact,
          }
        : null,
      balls: getBalls().map((ball) => ({
        id: ball.label,
        position: roundVector(ball.position),
        velocity: roundVector(ball.velocity),
        angle: round(ball.angle),
        angularVelocity: round(ball.angularVelocity),
        spin: roundVector(ball.spin),
        pocketed: Boolean(ball.plugin.pocketed),
        lastContact: ball.plugin.lastContact,
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
      .every((ball) => {
        const speed = length(ball.velocity);
        return speed < PHYSICS.sleepSpeed && Math.abs(ball.angularVelocity) < PHYSICS.sleepAngularSpeed;
      });
  }

  function replaceCue(position = findOpenCueSpot()) {
    const cue = cueBall();
    if (!cue) return;

    cue.plugin.pocketed = false;
    cue.plugin.lastContact = null;
    Body.setPosition(cue, position);
    Body.setVelocity(cue, { x: 0, y: 0 });
    Body.setAngularVelocity(cue, 0);
    cue.spin = { x: 0, y: 0 };
    syncWorldBodies();
  }

  function gameState() {
    return cloneRules(rules);
  }

  function fixedStep(dt) {
    engine.timing.timestamp += dt * 1000;

    getBalls().forEach((ball) => {
      if (ball.plugin.pocketed) return;
      applyClothAndSpin(ball, dt);
      integrateBall(ball, dt);
      detectPocket(ball);
    });

    for (let i = 0; i < PHYSICS.collisionIterations; i += 1) {
      resolveBallCollisions();
    }

    getBalls().forEach((ball) => {
      if (ball.plugin.pocketed) return;
      applyRailBounce(ball);
      detectPocket(ball);
      sleepIfSlow(ball);
    });
  }

  function applyClothAndSpin(ball, dt) {
    const speed = length(ball.velocity);
    if (speed <= 0) return;

    const dir = scale(ball.velocity, 1 / speed);
    const tangent = { x: -dir.y, y: dir.x };
    const drag = Math.max(0, 1 - PHYSICS.airDragPerSecond * dt);
    const sideGrip = ball.spin.x * PHYSICS.sideSpinGrip * dt;
    const topGrip = ball.spin.y * PHYSICS.topSpinGrip * dt;
    const nextSpeed = Math.max(0, speed - PHYSICS.rollingResistance * dt + topGrip);

    Body.setVelocity(ball, {
      x: (dir.x * nextSpeed + tangent.x * sideGrip) * drag,
      y: (dir.y * nextSpeed + tangent.y * sideGrip) * drag,
    });

    const spinDecay = Math.max(0, 1 - PHYSICS.spinDecayPerSecond * dt);
    ball.spin.x *= spinDecay;
    ball.spin.y *= spinDecay;
    Body.setAngularVelocity(ball, (nextSpeed / TABLE.ballRadius) * Math.sign(ball.angularVelocity || 1));
  }

  function integrateBall(ball, dt) {
    ball.position.x += ball.velocity.x * dt;
    ball.position.y += ball.velocity.y * dt;
    ball.angle += ball.angularVelocity * dt;
  }

  function resolveBallCollisions() {
    const balls = getBalls().filter((ball) => !ball.plugin.pocketed);

    for (let i = 0; i < balls.length - 1; i += 1) {
      for (let j = i + 1; j < balls.length; j += 1) {
        const a = balls[i];
        const b = balls[j];
        const delta = subtract(b.position, a.position);
        const distSq = dot(delta, delta);
        const minDist = TABLE.ballRadius * 2;

        if (distSq <= 0 || distSq >= minDist * minDist) continue;

        const dist = Math.sqrt(distSq);
        const normal = scale(delta, 1 / dist);
        const tangent = { x: -normal.y, y: normal.x };
        const overlap = minDist - dist;
        const correction = overlap / 2 + 0.01;

        a.position.x -= normal.x * correction;
        a.position.y -= normal.y * correction;
        b.position.x += normal.x * correction;
        b.position.y += normal.y * correction;

        const relativeVelocity = subtract(b.velocity, a.velocity);
        const normalSpeed = dot(relativeVelocity, normal);

        a.plugin.lastContact = b.label;
        b.plugin.lastContact = a.label;
        recordFirstContact(a, b);

        if (normalSpeed >= 0) continue;

        const impulse = (-(1 + PHYSICS.ballRestitution) * normalSpeed) / 2;
        a.velocity.x -= normal.x * impulse;
        a.velocity.y -= normal.y * impulse;
        b.velocity.x += normal.x * impulse;
        b.velocity.y += normal.y * impulse;

        const tangentSpeed = dot(relativeVelocity, tangent);
        const tangentImpulse = clamp(-tangentSpeed * PHYSICS.ballFriction, -28, 28);
        a.velocity.x -= tangent.x * tangentImpulse;
        a.velocity.y -= tangent.y * tangentImpulse;
        b.velocity.x += tangent.x * tangentImpulse;
        b.velocity.y += tangent.y * tangentImpulse;

        transferCueSpin(a, b, normal, tangent);
      }
    }
  }

  function transferCueSpin(a, b, normal, tangent) {
    const cue = a.label === "cue" ? a : b.label === "cue" ? b : null;
    if (!cue) return;

    const cueIsA = cue === a;
    const cueToObject = cueIsA ? normal : scale(normal, -1);
    const object = cueIsA ? b : a;
    const follow = cue.spin.y * 190;
    const english = cue.spin.x * 105;

    cue.velocity.x += cueToObject.x * follow + tangent.x * english;
    cue.velocity.y += cueToObject.y * follow + tangent.y * english;
    object.velocity.x += tangent.x * english * 0.42;
    object.velocity.y += tangent.y * english * 0.42;

    cue.spin.x *= 0.42;
    cue.spin.y *= 0.36;
  }

  function applyRailBounce(ball) {
    let hitRail = null;

    if (ball.position.x < FIELD.left) {
      ball.position.x = FIELD.left;
      ball.velocity.x = Math.abs(ball.velocity.x) * PHYSICS.cushionRestitution;
      ball.velocity.y += ball.spin.x * PHYSICS.railEnglishGrip;
      hitRail = "left";
    } else if (ball.position.x > FIELD.right) {
      ball.position.x = FIELD.right;
      ball.velocity.x = -Math.abs(ball.velocity.x) * PHYSICS.cushionRestitution;
      ball.velocity.y -= ball.spin.x * PHYSICS.railEnglishGrip;
      hitRail = "right";
    }

    if (ball.position.y < FIELD.top) {
      ball.position.y = FIELD.top;
      ball.velocity.y = Math.abs(ball.velocity.y) * PHYSICS.cushionRestitution;
      ball.velocity.x -= ball.spin.x * PHYSICS.railEnglishGrip;
      hitRail = hitRail ?? "top";
    } else if (ball.position.y > FIELD.bottom) {
      ball.position.y = FIELD.bottom;
      ball.velocity.y = -Math.abs(ball.velocity.y) * PHYSICS.cushionRestitution;
      ball.velocity.x += ball.spin.x * PHYSICS.railEnglishGrip;
      hitRail = hitRail ?? "bottom";
    }

    if (!hitRail) return;

    ball.velocity.x *= 1 - PHYSICS.cushionFriction;
    ball.velocity.y *= 1 - PHYSICS.cushionFriction;
    ball.spin.x *= 0.64;
    ball.spin.y *= 0.7;
    recordRailContact(ball, hitRail);
  }

  function detectPocket(ball) {
    const pocket = POCKETS.find(
      (candidate) => distance(ball.position, candidate) < TABLE.pocketRadius * PHYSICS.pocketFalloff,
    );

    if (!pocket) return;

    const speed = length(ball.velocity);
    const fallLine = subtract(pocket, ball.position);
    const movingIntoPocket = dot(ball.velocity, fallLine) >= -speed * TABLE.pocketRadius * 0.08;
    const deepInPocket = distance(ball.position, pocket) < TABLE.pocketRadius * 0.68;

    if (!movingIntoPocket && !deepInPocket) return;

    ball.plugin.pocketed = true;
    Body.setPosition(ball, pocket);
    Body.setVelocity(ball, { x: 0, y: 0 });
    Body.setAngularVelocity(ball, 0);
    ball.spin = { x: 0, y: 0 };

    const data = getBallData(ball.label);
    if (currentShot) {
      currentShot.pocketed.push({
        id: data.id,
        number: data.number,
        type: data.type,
      });
      if (data.type === "cue") currentShot.cuePocketed = true;
    }

    onPocket?.(data, snapshot());
    syncWorldBodies();
  }

  function sleepIfSlow(ball) {
    if (length(ball.velocity) >= PHYSICS.sleepSpeed) return;

    Body.setVelocity(ball, { x: 0, y: 0 });
    Body.setAngularVelocity(ball, 0);
    ball.spin = { x: 0, y: 0 };
  }

  function recordFirstContact(a, b) {
    if (!currentShot?.firstContact) {
      const other = a.label === "cue" ? b : b.label === "cue" ? a : null;
      if (!other || other.plugin.type === "cue") return;

      const data = getBallData(other.label);
      currentShot.firstContact = {
        id: data.id,
        number: data.number,
        type: data.type,
      };
    }
  }

  function recordRailContact(ball, rail) {
    if (!currentShot) return;

    currentShot.railContacts.add(ball.label);
    if (currentShot.firstContact) {
      currentShot.railAfterContact = true;
    }

    ball.plugin.lastContact = `rail:${rail}`;
  }

  function finalizeShot() {
    const shot = currentShot;
    currentShot = null;

    const result = evaluateShot(shot);
    const nextRules = {
      ...rules,
      phase: result.phase,
      currentPlayer: result.nextPlayer,
      groups: result.groups,
      ballInHand: result.foul !== null,
      foul: result.foul,
      winner: result.winner,
      lastShot: {
        id: shot.id,
        player: shot.player,
        command: shot.command,
        firstContact: shot.firstContact,
        pocketed: shot.pocketed,
        railContacts: Array.from(shot.railContacts),
        railAfterContact: shot.railAfterContact,
        foul: result.foul,
        turnSwitched: result.nextPlayer !== shot.player,
        winner: result.winner,
      },
    };

    rules = nextRules;
  }

  function evaluateShot(shot) {
    const player = shot.player;
    const opponent = player === 0 ? 1 : 0;
    const pocketed = shot.pocketed;
    const objectPockets = pocketed.filter((ball) => ball.type === "solid" || ball.type === "stripe");
    const eightPocketed = pocketed.some((ball) => ball.type === "eight");
    const madeObject = objectPockets.length > 0;
    const groups = { ...rules.groups };
    let phase = rules.phase === GAME_PHASES.BREAK ? GAME_PHASES.OPEN : rules.phase;
    let foul = null;
    let winner = null;

    if (shot.cuePocketed) {
      foul = FOULS.SCRATCH;
    }

    if (!shot.firstContact && !foul) {
      foul = FOULS.NO_CONTACT;
    }

    if (shot.firstContact && !foul) {
      foul = validateFirstContact(shot.firstContact, player);
    }

    if (!foul && !madeObject && !eightPocketed && !shot.railAfterContact) {
      foul = FOULS.NO_RAIL_AFTER_CONTACT;
    }

    if (shot.startedInPhase === GAME_PHASES.BREAK && !foul && !madeObject && shot.railContacts.size < 4) {
      foul = FOULS.ILLEGAL_BREAK;
    }

    if (eightPocketed) {
      const canWinOnEight = !foul && groups[player] && remainingGroupBalls(player) === 0;
      winner = canWinOnEight ? player : opponent;
      phase = GAME_PHASES.ENDED;
      return { phase, nextPlayer: player, groups, foul, winner };
    }

    const assignment = !foul && maybeAssignGroups(groups, player, objectPockets);
    if (assignment) {
      groups[player] = assignment;
      groups[opponent] = assignment === "solid" ? "stripe" : "solid";
      phase = GAME_PHASES.ASSIGNED;
    }

    if (foul) {
      return { phase, nextPlayer: opponent, groups, foul, winner };
    }

    const playerGroup = groups[player];
    const legalPocket = playerGroup
      ? objectPockets.some((ball) => ball.type === playerGroup)
      : objectPockets.length > 0;

    return {
      phase,
      nextPlayer: legalPocket ? player : opponent,
      groups,
      foul,
      winner,
    };
  }

  function validateFirstContact(firstContact, player) {
    if (rules.phase === GAME_PHASES.BREAK) return null;

    const playerGroup = rules.groups[player];
    if (!playerGroup) {
      return firstContact.type === "eight" ? FOULS.EIGHT_FIRST_OPEN : null;
    }

    const target = remainingGroupBalls(player) > 0 ? playerGroup : "eight";
    return firstContact.type === target ? null : FOULS.WRONG_FIRST_BALL;
  }

  function maybeAssignGroups(groups, player, objectPockets) {
    if (groups[player] || objectPockets.length === 0) return null;

    const firstGroupBall = objectPockets.find((ball) => ball.type === "solid" || ball.type === "stripe");
    return firstGroupBall?.type ?? null;
  }

  function remainingGroupBalls(player) {
    const group = rules.groups[player];
    if (!group) return Infinity;

    return getBalls().filter((ball) => !ball.plugin.pocketed && ball.plugin.type === group).length;
  }

  function rackBalls() {
    ballMap.clear();
    createRack().forEach((ball) => {
      ballMap.set(ball.label, ball);
    });
    syncWorldBodies();
  }

  function syncWorldBodies() {
    engine.world.bodies = getBalls().filter((ball) => !ball.plugin.pocketed);
  }

  function findOpenCueSpot() {
    const preferred = { x: TABLE.width * 0.26, y: TABLE.height / 2 };
    if (isSpotOpen(preferred)) return preferred;

    for (let ring = 1; ring <= 7; ring += 1) {
      const radius = ring * BALL_DIAMETER * 0.82;
      for (let i = 0; i < 16; i += 1) {
        const angle = (i / 16) * Math.PI * 2;
        const spot = {
          x: clamp(preferred.x + Math.cos(angle) * radius, FIELD.left, FIELD.right),
          y: clamp(preferred.y + Math.sin(angle) * radius, FIELD.top, FIELD.bottom),
        };
        if (isSpotOpen(spot)) return spot;
      }
    }

    return preferred;
  }

  function isSpotOpen(spot) {
    return getBalls()
      .filter((ball) => !ball.plugin.pocketed && ball.label !== "cue")
      .every((ball) => distance(ball.position, spot) > BALL_DIAMETER * 1.08);
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
    gameState,
    predictShot,
  };

  function predictShot({ angle, power = 0.5, spin = {} } = {}) {
    const cue = cueBall();
    if (!cue || cue.plugin.pocketed) return null;

    const normalizedShot = normalizeShot({
      id: "cue",
      angle,
      power,
      spin,
      shotId: "preview",
    });
    const direction = { x: Math.cos(normalizedShot.angle), y: Math.sin(normalizedShot.angle) };
    const origin = { ...cue.position };
    const cueHit = raycast(origin, direction, cue.label);
    const mainGuideLength = 640 + normalizedShot.power * 140;

    if (!cueHit) {
      return {
        cuePath: [origin, pointBeforeRail(origin, direction, mainGuideLength)],
        objectPath: null,
        ghostBall: null,
        hitBall: null,
      };
    }

    if (cueHit.kind === "rail") {
      const cuePath = [origin, add(origin, scale(direction, Math.min(cueHit.travel, mainGuideLength)))];
      return { cuePath, objectPath: null, ghostBall: null, hitBall: null };
    }

    const contactDistance = cueHit.travel;
    const hitBall = ballMap.get(cueHit.id);
    const normal = normalize(subtract(hitBall.position, cueHit.point));
    const objectDirection = normal;
    const cueDeflectDirection = normalize({
      x: direction.x - normal.x * dot(direction, normal),
      y: direction.y - normal.y * dot(direction, normal),
    });
    const objectGuideLength = clamp(520 - contactDistance * 0.72 + normalizedShot.power * 70, 70, 360);
    const objectEnd = pointBeforeRail(hitBall.position, objectDirection, objectGuideLength);
    const cueDeflectEnd = length(cueDeflectDirection) > 0
      ? pointBeforeRail(cueHit.point, cueDeflectDirection, clamp(190 - contactDistance * 0.18, 55, 170))
      : cueHit.point;

    return {
      cuePath: [origin, cueHit.point, cueDeflectEnd],
      objectPath: [hitBall.position, objectEnd],
      ghostBall: contactDistance < 560 ? cueHit.point : null,
      hitBall: {
        id: hitBall.label,
        number: hitBall.plugin.number,
        type: hitBall.plugin.type,
      },
    };
  }

  function raycast(origin, direction, ignoreId) {
    let nearest = null;

    getBalls().forEach((ball) => {
      if (ball.plugin.pocketed || ball.label === ignoreId) return;
      const toBall = subtract(ball.position, origin);
      const projected = dot(toBall, direction);
      if (projected <= 0) return;

      const closest = add(origin, scale(direction, projected));
      const miss = distance(closest, ball.position);
      const hitRadius = TABLE.ballRadius * 2;
      if (miss > hitRadius) return;

      const offset = Math.sqrt(hitRadius * hitRadius - miss * miss);
      const travel = projected - offset;
      if (travel <= 0) return;

      if (!nearest || travel < nearest.travel) {
        nearest = {
          kind: "ball",
          id: ball.label,
          travel,
          point: add(origin, scale(direction, travel)),
        };
      }
    });

    const railPoint = extendToRail(origin, direction);
    const railTravel = distance(origin, railPoint);
    if (!nearest || railTravel < nearest.travel) {
      return { kind: "rail", travel: railTravel, point: railPoint };
    }

    return nearest;
  }
}

const Body = {
  setPosition(ball, position) {
    ball.position = {
      x: Number(position.x),
      y: Number(position.y),
    };
  },
  setVelocity(ball, velocity) {
    ball.velocity = {
      x: Number(velocity.x),
      y: Number(velocity.y),
    };
  },
  setAngularVelocity(ball, angularVelocity) {
    ball.angularVelocity = Number(angularVelocity);
  },
};

function createRack() {
  const startX = TABLE.width * 0.69;
  const startY = TABLE.height / 2;
  const gap = TABLE.ballRadius * 2.08;
  const order = [1, 9, 2, 10, 8, 3, 11, 4, 12, 5, 13, 6, 14, 7, 15];
  const balls = [makeBall(BALLS[0], TABLE.width * 0.26, TABLE.height / 2)];

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
  return {
    id: data.id,
    label: data.id,
    radius: TABLE.ballRadius,
    mass: PHYSICS.ballMass,
    restitution: PHYSICS.ballRestitution,
    position: { x, y },
    velocity: { x: 0, y: 0 },
    angle: 0,
    angularVelocity: 0,
    spin: { x: 0, y: 0 },
    plugin: {
      kind: "ball",
      number: data.number,
      color: data.color,
      type: data.type,
      pocketed: false,
      lastContact: null,
    },
  };
}

function normalizeShot({ id, angle, power, spin, turnToken, shotId }) {
  return {
    id,
    angle: round(Number.isFinite(angle) ? angle : 0, 6),
    power: round(clamp(Number(power) || 0, 0, 1), 5),
    spin: {
      x: round(clamp(Number(spin?.x) || 0, -1, 1), 5),
      y: round(clamp(Number(spin?.y) || 0, -1, 1), 5),
    },
    turnToken,
    shotId,
  };
}

function normalizeRules(nextRules) {
  return {
    phase: nextRules.phase ?? INITIAL_RULES.phase,
    currentPlayer: nextRules.currentPlayer ?? INITIAL_RULES.currentPlayer,
    groups: {
      0: nextRules.groups?.[0] ?? null,
      1: nextRules.groups?.[1] ?? null,
    },
    ballInHand: Boolean(nextRules.ballInHand),
    foul: nextRules.foul ?? null,
    winner: nextRules.winner ?? null,
    lastShot: nextRules.lastShot ?? null,
    shotNumber: nextRules.shotNumber ?? 0,
  };
}

function cloneRules(source) {
  return {
    ...source,
    groups: { ...source.groups },
    lastShot: source.lastShot
      ? {
          ...source.lastShot,
          command: source.lastShot.command ? { ...source.lastShot.command } : null,
          firstContact: source.lastShot.firstContact ? { ...source.lastShot.firstContact } : null,
          pocketed: source.lastShot.pocketed ? source.lastShot.pocketed.map((ball) => ({ ...ball })) : [],
          railContacts: source.lastShot.railContacts ? [...source.lastShot.railContacts] : [],
        }
      : null,
  };
}

function getBallData(id) {
  return BALLS.find((ball) => ball.id === id) ?? BALLS[0];
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function lerp(from, to, amount) {
  return from + (to - from) * amount;
}

function length(vector) {
  return Math.hypot(vector.x, vector.y);
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y;
}

function subtract(a, b) {
  return {
    x: a.x - b.x,
    y: a.y - b.y,
  };
}

function add(a, b) {
  return {
    x: a.x + b.x,
    y: a.y + b.y,
  };
}

function scale(vector, amount) {
  return {
    x: vector.x * amount,
    y: vector.y * amount,
  };
}

function normalize(vector) {
  const vectorLength = length(vector);
  if (vectorLength === 0) return { x: 0, y: 0 };
  return scale(vector, 1 / vectorLength);
}

function extendToRail(origin, direction) {
  const candidates = [];

  if (direction.x > 0) candidates.push((FIELD.right - origin.x) / direction.x);
  if (direction.x < 0) candidates.push((FIELD.left - origin.x) / direction.x);
  if (direction.y > 0) candidates.push((FIELD.bottom - origin.y) / direction.y);
  if (direction.y < 0) candidates.push((FIELD.top - origin.y) / direction.y);

  const travel = Math.min(...candidates.filter((value) => value > 0));
  if (!Number.isFinite(travel)) return { ...origin };

  return {
    x: clamp(origin.x + direction.x * travel, FIELD.left, FIELD.right),
    y: clamp(origin.y + direction.y * travel, FIELD.top, FIELD.bottom),
  };
}

function pointBeforeRail(origin, direction, maxTravel) {
  const railPoint = extendToRail(origin, direction);
  const railTravel = distance(origin, railPoint);
  const travel = Math.min(maxTravel, railTravel);
  return add(origin, scale(direction, travel));
}

function round(value, precision = 4) {
  const multiplier = 10 ** precision;
  return Math.round((Number(value) || 0) * multiplier) / multiplier;
}

function roundVector(vector) {
  return {
    x: round(vector.x),
    y: round(vector.y),
  };
}
