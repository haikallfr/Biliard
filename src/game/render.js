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
    drawAim(ctx, game, cue, state.aim);
  }

  game.getBalls()
    .filter((ball) => !ball.plugin.pocketed)
    .sort((a, b) => a.position.y - b.position.y)
    .forEach((ball) => drawBallShadow(ctx, ball, ballRadius));

  game.getBalls()
    .filter((ball) => !ball.plugin.pocketed)
    .forEach((ball) => drawBall(ctx, ball, ballRadius));

  ctx.save();
  ctx.fillStyle = "rgba(247, 240, 211, 0.42)";
  ctx.font = "600 12px Inter, system-ui, sans-serif";
  ctx.fillText("BREAKROOM 8", rail + 8, height - rail - 16);
  ctx.restore();
}

function drawOuterFrame(ctx, width, height) {
  const frame = ctx.createLinearGradient(0, 0, 0, height);
  frame.addColorStop(0, "#b46e31");
  frame.addColorStop(0.18, "#5d341b");
  frame.addColorStop(0.52, "#24120c");
  frame.addColorStop(0.82, "#7b431f");
  frame.addColorStop(1, "#e0a05a");

  roundRect(ctx, 12, 12, width - 24, height - 24, 28);
  ctx.fillStyle = frame;
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 219, 137, 0.58)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.save();
  ctx.strokeStyle = "rgba(34, 16, 9, 0.7)";
  ctx.lineWidth = 10;
  roundRect(ctx, 24, 24, width - 48, height - 48, 24);
  ctx.stroke();
  ctx.restore();

  drawRailInlays(ctx);
}

function drawFelt(ctx, resources) {
  const { width, height, rail } = TABLE;

  roundRect(ctx, rail, rail, width - rail * 2, height - rail * 2, 10);
  ctx.save();
  ctx.clip();

  if (resources.feltPattern) {
    ctx.fillStyle = resources.feltPattern;
    ctx.fillRect(rail, rail, width - rail * 2, height - rail * 2);
  } else {
    const felt = ctx.createLinearGradient(rail, rail, width - rail, height - rail);
    felt.addColorStop(0, "#0cc55c");
    felt.addColorStop(0.48, "#08a94d");
    felt.addColorStop(1, "#057d3f");
    ctx.fillStyle = felt;
    ctx.fillRect(rail, rail, width - rail * 2, height - rail * 2);
  }

  const glow = ctx.createRadialGradient(width * 0.48, height * 0.48, 60, width * 0.48, height * 0.48, width * 0.52);
  glow.addColorStop(0, "rgba(68, 255, 142, 0.3)");
  glow.addColorStop(0.58, "rgba(8, 128, 61, 0.08)");
  glow.addColorStop(1, "rgba(3, 37, 23, 0.32)");
  ctx.fillStyle = glow;
  ctx.fillRect(rail, rail, width - rail * 2, height - rail * 2);

  ctx.restore();
}

function drawRails(ctx) {
  const { width, height, rail } = TABLE;
  const cushion = 24;
  const feltLeft = rail;
  const feltRight = width - rail;
  const feltTop = rail;
  const feltBottom = height - rail;

  ctx.save();

  drawCushion(ctx, [
    { x: feltLeft + 42, y: feltTop - cushion },
    { x: width / 2 - 44, y: feltTop - cushion },
    { x: width / 2 - 62, y: feltTop },
    { x: feltLeft + 26, y: feltTop },
  ]);
  drawCushion(ctx, [
    { x: width / 2 + 44, y: feltTop - cushion },
    { x: feltRight - 42, y: feltTop - cushion },
    { x: feltRight - 26, y: feltTop },
    { x: width / 2 + 62, y: feltTop },
  ]);
  drawCushion(ctx, [
    { x: feltLeft + 42, y: feltBottom + cushion },
    { x: width / 2 - 44, y: feltBottom + cushion },
    { x: width / 2 - 62, y: feltBottom },
    { x: feltLeft + 26, y: feltBottom },
  ]);
  drawCushion(ctx, [
    { x: width / 2 + 44, y: feltBottom + cushion },
    { x: feltRight - 42, y: feltBottom + cushion },
    { x: feltRight - 26, y: feltBottom },
    { x: width / 2 + 62, y: feltBottom },
  ]);
  drawCushion(ctx, [
    { x: feltLeft - cushion, y: feltTop + 42 },
    { x: feltLeft, y: feltTop + 26 },
    { x: feltLeft, y: feltBottom - 26 },
    { x: feltLeft - cushion, y: feltBottom - 42 },
  ]);
  drawCushion(ctx, [
    { x: feltRight + cushion, y: feltTop + 42 },
    { x: feltRight, y: feltTop + 26 },
    { x: feltRight, y: feltBottom - 26 },
    { x: feltRight + cushion, y: feltBottom - 42 },
  ]);

  ctx.strokeStyle = "rgba(255, 218, 121, 0.32)";
  ctx.lineWidth = 2;
  roundRect(ctx, rail - 28, rail - 28, width - rail * 2 + 56, height - rail * 2 + 56, 18);
  ctx.stroke();

  ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
  ctx.lineWidth = 4;
  roundRect(ctx, rail - 4, rail - 4, width - rail * 2 + 8, height - rail * 2 + 8, 12);
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
    const rimRadius = TABLE.pocketRadius + 5;
    const rim = ctx.createRadialGradient(pocket.x - 5, pocket.y - 5, 2, pocket.x, pocket.y, rimRadius);
    rim.addColorStop(0, "#d68a47");
    rim.addColorStop(0.42, "#5a2c13");
    rim.addColorStop(1, "#160907");
    ctx.fillStyle = rim;
    ctx.beginPath();
    ctx.arc(pocket.x, pocket.y, rimRadius, 0, Math.PI * 2);
    ctx.fill();

    const gradient = ctx.createRadialGradient(
      pocket.x - 5,
      pocket.y - 7,
      1,
      pocket.x,
      pocket.y,
      TABLE.pocketRadius,
    );
    gradient.addColorStop(0, "#25211b");
    gradient.addColorStop(0.35, "#050504");
    gradient.addColorStop(1, "#000000");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(pocket.x, pocket.y, TABLE.pocketRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 226, 151, 0.36)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });
}

function drawRailInlays(ctx) {
  const { width, height, rail } = TABLE;
  const topY = rail - 34;
  const bottomY = height - rail + 34;
  const leftX = rail - 34;
  const rightX = width - rail + 34;

  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(255, 218, 126, 0.5)";
  ctx.fillStyle = "rgba(26, 12, 8, 0.54)";

  for (let x = rail + 96; x < width - rail - 60; x += 112) {
    drawInlay(ctx, x, topY, 58, 17, false);
    drawInlay(ctx, x, bottomY, 58, 17, false);
  }

  for (let y = rail + 70; y < height - rail - 38; y += 92) {
    drawInlay(ctx, leftX, y, 17, 52, true);
    drawInlay(ctx, rightX, y, 17, 52, true);
  }

  ctx.restore();
}

function drawInlay(ctx, x, y, width, height, vertical) {
  ctx.save();
  ctx.translate(x, y);
  if (vertical) ctx.rotate(Math.PI / 2);

  roundRect(ctx, -width / 2, -height / 2, width, height, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#d79a48";
  ctx.beginPath();
  ctx.arc(-width * 0.24, 0, 5, 0, Math.PI * 2);
  ctx.arc(width * 0.24, 0, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 245, 186, 0.74)";
  ctx.beginPath();
  ctx.moveTo(-width * 0.08, -height * 0.24);
  ctx.lineTo(width * 0.08, height * 0.24);
  ctx.moveTo(width * 0.08, -height * 0.24);
  ctx.lineTo(-width * 0.08, height * 0.24);
  ctx.stroke();

  ctx.restore();
}

function drawCushion(ctx, points) {
  const gradient = ctx.createLinearGradient(points[0].x, points[0].y, points[2].x, points[2].y);
  gradient.addColorStop(0, "#20d56a");
  gradient.addColorStop(0.45, "#0aa447");
  gradient.addColorStop(1, "#045b2e");

  ctx.fillStyle = gradient;
  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(179, 255, 182, 0.32)";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawAim(ctx, game, cue, aim) {
  const point = aim.point ?? aim;
  const dx = point.x - cue.position.x;
  const dy = point.y - cue.position.y;
  const shotAngle = Number.isFinite(aim.angle) ? aim.angle : Math.atan2(dy, dx) + Math.PI;
  const stickAngle = shotAngle + Math.PI;
  const power = aim.power ?? 0;
  const spin = aim.spin ?? { x: 0, y: 0 };
  const prediction = game.predictShot?.({ angle: shotAngle, power, spin });

  ctx.save();
  if (prediction) {
    drawPrediction(ctx, prediction, power);
  }

  const cueBack = 70 + power * 145;
  ctx.setLineDash([]);
  ctx.lineCap = "round";
  ctx.shadowColor = "rgba(0, 0, 0, 0.46)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetX = Math.cos(stickAngle + Math.PI / 2) * 7;
  ctx.shadowOffsetY = Math.sin(stickAngle + Math.PI / 2) * 7;
  ctx.strokeStyle = "#5c3317";
  ctx.lineWidth = 11;
  ctx.beginPath();
  ctx.moveTo(
    cue.position.x + Math.cos(stickAngle) * 28,
    cue.position.y + Math.sin(stickAngle) * 28,
  );
  ctx.lineTo(
    cue.position.x + Math.cos(stickAngle) * cueBack,
    cue.position.y + Math.sin(stickAngle) * cueBack,
  );
  ctx.stroke();

  const wood = ctx.createLinearGradient(
    cue.position.x + Math.cos(stickAngle) * 24,
    cue.position.y + Math.sin(stickAngle) * 24,
    cue.position.x + Math.cos(stickAngle) * cueBack,
    cue.position.y + Math.sin(stickAngle) * cueBack,
  );
  wood.addColorStop(0, "#ead9a2");
  wood.addColorStop(0.16, "#f9edc9");
  wood.addColorStop(0.22, "#8a5730");
  wood.addColorStop(1, "#c18a4e");

  ctx.shadowBlur = 0;
  ctx.strokeStyle = wood;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(
    cue.position.x + Math.cos(stickAngle) * 28,
    cue.position.y + Math.sin(stickAngle) * 28,
  );
  ctx.lineTo(
    cue.position.x + Math.cos(stickAngle) * cueBack,
    cue.position.y + Math.sin(stickAngle) * cueBack,
  );
  ctx.stroke();

  ctx.strokeStyle = "#eef0dc";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(
    cue.position.x + Math.cos(stickAngle) * 24,
    cue.position.y + Math.sin(stickAngle) * 24,
  );
  ctx.lineTo(
    cue.position.x + Math.cos(stickAngle) * 44,
    cue.position.y + Math.sin(stickAngle) * 44,
  );
  ctx.stroke();

  drawSpinBadge(ctx, cue, spin);
  ctx.restore();
}

function drawPrediction(ctx, prediction, power) {
  const alpha = 0.38 + power * 0.42;

  if (prediction.cuePath?.length > 1) {
    ctx.strokeStyle = `rgba(255, 238, 177, ${alpha})`;
    ctx.lineWidth = 3;
    ctx.setLineDash([22, 13]);
    ctx.beginPath();
    prediction.cuePath.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.stroke();
  }

  if (prediction.objectPath?.length > 1) {
    ctx.strokeStyle = "rgba(138, 221, 255, 0.62)";
    ctx.lineWidth = 2.5;
    ctx.setLineDash([12, 12]);
    ctx.beginPath();
    ctx.moveTo(prediction.objectPath[0].x, prediction.objectPath[0].y);
    ctx.lineTo(prediction.objectPath[1].x, prediction.objectPath[1].y);
    ctx.stroke();
  }

  if (prediction.ghostBall) {
    ctx.setLineDash([]);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.34)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(prediction.ghostBall.x, prediction.ghostBall.y, TABLE.ballRadius, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawSpinBadge(ctx, cue, spin) {
  if (!spin || (Math.abs(spin.x) < 0.02 && Math.abs(spin.y) < 0.02)) return;

  const x = cue.position.x + spin.x * 10;
  const y = cue.position.y - spin.y * 10;
  ctx.fillStyle = "rgba(33, 45, 41, 0.72)";
  ctx.beginPath();
  ctx.arc(cue.position.x, cue.position.y, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffdf8a";
  ctx.beginPath();
  ctx.arc(x, y, 3.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawBallShadow(ctx, ball, radius) {
  const speed = Math.hypot(ball.velocity.x, ball.velocity.y);
  const offset = Math.min(8, 3 + speed / 240);

  ctx.save();
  ctx.translate(ball.position.x + offset, ball.position.y + offset * 0.72);
  ctx.scale(1.18, 0.72);
  const shadow = ctx.createRadialGradient(0, 0, 1, 0, 0, radius + 8);
  shadow.addColorStop(0, "rgba(0, 0, 0, 0.32)");
  shadow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = shadow;
  ctx.beginPath();
  ctx.arc(0, 0, radius + 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBall(ctx, ball, radius) {
  const data = BALLS.find((entry) => entry.id === ball.label);
  const { x, y } = ball.position;
  const rotation = ball.angle;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);

  const shadow = ctx.createRadialGradient(-6, -8, 2, 2, 5, radius + 8);
  shadow.addColorStop(0, "rgba(255, 255, 255, 0.94)");
  shadow.addColorStop(0.24, data.type === "cue" ? "#fffdf0" : data.color);
  shadow.addColorStop(0.72, data.color);
  shadow.addColorStop(1, "#050605");

  ctx.fillStyle = data.type === "cue" ? shadow : shadow;
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

  ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(0, 0, radius - 0.8, 0, Math.PI * 2);
  ctx.stroke();

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
