import { BALLS, POCKETS, TABLE } from "./constants";

export function drawTable(ctx, game, state, resources) {
  const { width, height, rail, ballRadius } = TABLE;
  ctx.clearRect(0, 0, width, height);

  drawOuterFrame(ctx, width, height);
  drawFelt(ctx, resources);
  drawRails(ctx);
  drawGuides(ctx);
  drawPockets(ctx);

  const cue = game.cueBall();
  if (state.aim && cue && !cue.plugin.pocketed) {
    drawAim(ctx, cue, state.aim);
  }

  game.getBalls().forEach((ball) => {
    if (!ball.plugin.pocketed) drawBall(ctx, ball, ballRadius);
  });

  ctx.save();
  ctx.fillStyle = "rgba(247, 240, 211, 0.42)";
  ctx.font = "600 12px Inter, system-ui, sans-serif";
  ctx.fillText("BREAKROOM 8", rail + 8, height - rail - 16);
  ctx.restore();
}

function drawOuterFrame(ctx, width, height) {
  const frame = ctx.createLinearGradient(0, 0, width, height);
  frame.addColorStop(0, "#4a2d18");
  frame.addColorStop(0.44, "#15100d");
  frame.addColorStop(1, "#714621");
  roundRect(ctx, 8, 8, width - 16, height - 16, 42);
  ctx.fillStyle = frame;
  ctx.fill();

  ctx.strokeStyle = "rgba(245, 216, 151, 0.26)";
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawFelt(ctx, resources) {
  const { width, height, rail } = TABLE;
  roundRect(ctx, rail, rail, width - rail * 2, height - rail * 2, 22);
  if (resources.feltPattern) {
    ctx.fillStyle = resources.feltPattern;
  } else {
    const felt = ctx.createLinearGradient(rail, rail, width - rail, height - rail);
    felt.addColorStop(0, "#166b4e");
    felt.addColorStop(1, "#0b3f35");
    ctx.fillStyle = felt;
  }
  ctx.fill();

  ctx.fillStyle = "rgba(7, 18, 15, 0.14)";
  ctx.fillRect(rail, rail, width - rail * 2, height - rail * 2);
}

function drawRails(ctx) {
  const { width, height, rail } = TABLE;
  ctx.save();
  ctx.strokeStyle = "rgba(238, 210, 142, 0.2)";
  ctx.lineWidth = 1;
  ctx.strokeRect(rail + 13, rail + 13, width - (rail + 13) * 2, height - (rail + 13) * 2);
  ctx.strokeStyle = "rgba(11, 8, 6, 0.55)";
  ctx.lineWidth = 10;
  roundRect(ctx, rail - 10, rail - 10, width - rail * 2 + 20, height - rail * 2 + 20, 30);
  ctx.stroke();
  ctx.restore();
}

function drawGuides(ctx) {
  const { width, height, rail } = TABLE;
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.strokeStyle = "#d7c892";
  ctx.lineWidth = 1;
  ctx.setLineDash([8, 18]);
  ctx.beginPath();
  ctx.moveTo(width * 0.25, rail + 22);
  ctx.lineTo(width * 0.25, height - rail - 22);
  ctx.moveTo(width / 2, rail + 22);
  ctx.lineTo(width / 2, height - rail - 22);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(width * 0.25, height / 2, 84, Math.PI / 2, -Math.PI / 2, true);
  ctx.stroke();
  ctx.restore();
}

function drawPockets(ctx) {
  POCKETS.forEach((pocket) => {
    const gradient = ctx.createRadialGradient(pocket.x, pocket.y, 2, pocket.x, pocket.y, TABLE.pocketRadius);
    gradient.addColorStop(0, "#020302");
    gradient.addColorStop(1, "#11100e");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(pocket.x, pocket.y, TABLE.pocketRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(245, 216, 151, 0.22)";
    ctx.lineWidth = 2;
    ctx.stroke();
  });
}

function drawAim(ctx, cue, aim) {
  const dx = aim.x - cue.position.x;
  const dy = aim.y - cue.position.y;
  const angle = Math.atan2(dy, dx);
  const pull = Math.min(Math.hypot(dx, dy), 190);
  const power = pull / 190;
  const targetAngle = angle + Math.PI;
  const endX = cue.position.x + Math.cos(targetAngle) * 620;
  const endY = cue.position.y + Math.sin(targetAngle) * 620;

  ctx.save();
  ctx.strokeStyle = `rgba(251, 231, 165, ${0.35 + power * 0.42})`;
  ctx.lineWidth = 3;
  ctx.setLineDash([18, 14]);
  ctx.beginPath();
  ctx.moveTo(cue.position.x, cue.position.y);
  ctx.lineTo(endX, endY);
  ctx.stroke();

  const cueBack = 70 + power * 130;
  ctx.setLineDash([]);
  ctx.lineCap = "round";
  ctx.strokeStyle = "#b9874f";
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(
    cue.position.x + Math.cos(angle) * 28,
    cue.position.y + Math.sin(angle) * 28,
  );
  ctx.lineTo(
    cue.position.x + Math.cos(angle) * cueBack,
    cue.position.y + Math.sin(angle) * cueBack,
  );
  ctx.stroke();

  ctx.strokeStyle = "#ead9a2";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(
    cue.position.x + Math.cos(angle) * 24,
    cue.position.y + Math.sin(angle) * 24,
  );
  ctx.lineTo(
    cue.position.x + Math.cos(angle) * 44,
    cue.position.y + Math.sin(angle) * 44,
  );
  ctx.stroke();
  ctx.restore();
}

function drawBall(ctx, ball, radius) {
  const data = BALLS.find((entry) => entry.id === ball.label);
  const { x, y } = ball.position;
  const rotation = ball.angle;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);

  const shadow = ctx.createRadialGradient(-4, -5, 2, 0, 0, radius + 6);
  shadow.addColorStop(0, "rgba(255, 255, 255, 0.86)");
  shadow.addColorStop(0.32, data.color);
  shadow.addColorStop(1, "#070807");

  ctx.fillStyle = data.type === "cue" ? "#f8f6e8" : shadow;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();

  if (data.type === "stripe") {
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, radius - 1, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = "#f6f0dc";
    ctx.fillRect(-radius, -7, radius * 2, 14);
    ctx.restore();
  }

  if (data.type !== "cue") {
    ctx.fillStyle = "#f6f0dc";
    ctx.beginPath();
    ctx.arc(0, 0, 7.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = data.number === 8 ? "#111" : "#1e251f";
    ctx.font = "700 8px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(data.number), 0, 0.5);
  }

  ctx.fillStyle = "rgba(255, 255, 255, 0.38)";
  ctx.beginPath();
  ctx.arc(-5, -7, 4.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}
