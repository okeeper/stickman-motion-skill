import { clamp, lerp, smooth, type Vec } from '../math.js';
import { CUES, FILM, TURN, storyAt, platformAt } from './model.js';

/** Film canvas only: playback controls and diagnostic text never enter the encoded frame. */
export function drawStory(ctx: CanvasRenderingContext2D, t: number, debug = false) {
  const f = storyAt(t),
    { rig: r, camera: c } = f;
  const scale = FILM.width / c.width;
  const p = (v: Vec) => ({ x: 640 + (v.x - c.x) * scale, y: 360 - (v.y - c.y) * scale });
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, FILM.width, FILM.height);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const white = '#f4f4f4',
    orange = '#ff931e';
  function line(a: Vec, b: Vec, color = white, width = 0.017) {
    const x = p(a),
      y = p(b);
    ctx.beginPath();
    ctx.moveTo(x.x, x.y);
    ctx.lineTo(y.x, y.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = width * scale;
    ctx.stroke();
  }
  function label(s: string, at: Vec, size: number, opacity = 1) {
    const q = p(at);
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.fillStyle = white;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${size * scale}px 'Math Sans'`;
    ctx.fillText(s, q.x, q.y);
    ctx.restore();
  }
  function circle(at: Vec, radius: number, color = white, width = 0.014) {
    const q = p(at);
    ctx.beginPath();
    ctx.arc(q.x, q.y, radius * scale, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = width * scale;
    ctx.stroke();
  }
  // Sparse spatial anchors, with a clear gap and a rail that ends before the far bank.
  line({ x: -2, y: 0 }, { x: 3.58, y: 0 }, white, 0.027);
  line({ x: 9.75, y: 0 }, { x: 16, y: 0 }, white, 0.027);
  line({ x: 3.58, y: 0 }, { x: 3.58, y: -0.17 });
  line({ x: 9.75, y: 0 }, { x: 9.75, y: -0.17 });
  line({ x: 3.85, y: -0.6 }, { x: platformAt(28).x, y: -0.6 }, '#303030', 0.01);
  line({ x: platformAt(28).x, y: -0.67 }, { x: platformAt(28).x, y: -0.53 }, '#777', 0.018);
  const px = f.platform.x;
  line({ x: px - 0.84, y: 0 }, { x: px + 0.84, y: 0 }, white, 0.06);
  line({ x: px - 0.65, y: -0.08 }, { x: px + 0.65, y: -0.08 }, '#666', 0.012);
  line({ x: px + 0.72, y: 0 }, { x: px + 0.72, y: 0.94 }, '#999', 0.015);
  label('×', { x: px + 0.18, y: 1.12 }, 0.32);
  const slot = p(f.slot);
  ctx.strokeStyle = t >= TURN ? white : '#777';
  ctx.lineWidth = 0.014 * scale;
  ctx.strokeRect(slot.x - 0.2 * scale, slot.y - 0.16 * scale, 0.4 * scale, 0.32 * scale);
  const dir = f.platform.direction;
  const center = { x: px, y: -0.31 },
    end = { x: px + dir * 0.5, y: -0.31 };
  line({ x: px - dir * 0.25, y: -0.31 }, end, '#ddd', 0.018);
  line(end, { x: end.x - dir * 0.14, y: end.y + 0.08 }, '#ddd', 0.018);
  line(end, { x: end.x - dir * 0.14, y: end.y - 0.08 }, '#ddd', 0.018);
  let formulaBoundsOK = true;
  if (t > 10.2 && t < 14.4) {
    const text = t < TURN ? 'd = −1' : 'd′ = −d = +1';
    const at = { x: px, y: 2.15 };
    label(text, at, 0.22, smooth(t, 10.2, 10.8) * (1 - smooth(t, 13.7, 14.4)));
    ctx.font = `${0.22 * scale}px 'Math Sans'`;
    const q = p(at),
      half = ctx.measureText(text).width / 2;
    formulaBoundsOK =
      q.x - half >= 20 &&
      q.x + half <= 1260 &&
      q.y - 0.11 * scale >= 20 &&
      q.y + 0.11 * scale <= 700;
  }
  // A short geometric response belongs to the operated symbol, then clears the acting space.
  if (t >= TURN && t < TURN + 0.8) {
    const u = (t - TURN) / 0.8;
    ctx.save();
    ctx.globalAlpha = (1 - u) * 0.55;
    circle(f.slot, 0.22 + u * 0.7);
    ctx.restore();
  }
  // Contact dust is event-driven. The actor, not the effect, supplies the weight.
  for (const e of CUES)
    if (e.kind === 'impact') {
      const dt = t - e.t;
      if (dt < 0 || dt > 0.45) continue;
      const x = e.t < 12 ? px : e.x;
      ctx.save();
      ctx.globalAlpha = (1 - dt / 0.45) * 0.6;
      for (const side of [-1, 1])
        for (let i = 0; i < 4; i++) {
          const at = {
            x: x + side * (0.08 + dt * (0.5 + i * 0.24)),
            y: Math.max(0, dt * (0.6 + i * 0.15) - 3 * dt * dt),
          };
          line(at, { x: at.x + 0.035 * side, y: at.y + 0.012 }, '#bbb', 0.01);
        }
      ctx.restore();
    }
  function limb(a: Vec, hinge: Vec, b: Vec, color: string, width = 0.044) {
    const x = p(a),
      h = p(hinge),
      y = p(b),
      before = lerp(h, x, 0.3),
      after = lerp(h, y, 0.3);
    ctx.beginPath();
    ctx.moveTo(x.x, x.y);
    ctx.lineTo(before.x, before.y);
    ctx.quadraticCurveTo(h.x, h.y, after.x, after.y);
    ctx.lineTo(y.x, y.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = width * scale;
    ctx.stroke();
  }
  limb(r.legs[0].a, r.legs[0].hinge, r.legs[0].b, '#d57618');
  limb(r.arms[0].a, r.arms[0].hinge, r.arms[0].b, '#d57618');
  limb(r.hip, r.spine, r.shoulder, orange, 0.048);
  limb(r.legs[1].a, r.legs[1].hinge, r.legs[1].b, orange);
  for (let i = 0; i < 2; i++) line(r.feet[i].ankle, r.feet[i].toe, i ? orange : '#d57618', 0.035);
  limb(r.arms[1].a, r.arms[1].hinge, r.arms[1].b, orange);
  line(r.shoulder, r.head, orange, 0.038);
  const head = p(r.head);
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(head.x, head.y, 0.125 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = orange;
  ctx.lineWidth = 0.044 * scale;
  ctx.stroke();
  label('−1', f.token, t >= TURN ? 0.22 : 0.28);
  if (debug) {
    for (const foot of r.feet) circle(foot.toe, 0.04, foot.planted ? '#8fdac2' : '#f57f7f');
    circle(r.hip, 0.035, '#8fdac2');
    label(`IK ${f.maxIK.toFixed(4)}`, { x: c.x, y: c.y + c.width * 0.22 }, 0.18);
  }
  const points = [
    r.head,
    r.hip,
    ...r.arms.flatMap((l) => [l.hinge, l.b]),
    ...r.feet.map((v) => v.toe),
    f.token,
  ].map(p);
  return {
    t: f.t,
    phase: f.phase,
    maxIK: f.maxIK,
    boundsOK: points.every((q) => q.x >= 20 && q.x <= 1260 && q.y >= 20 && q.y <= 700),
    tokenError: f.tokenAttached
      ? Math.hypot(f.token.x - r.arms[1].b.x, f.token.y - r.arms[1].b.y)
      : 0,
    formulaBoundsOK,
    rig: r,
    camera: c,
    platform: f.platform,
    brightness: clamp(1),
    arrowCenter: center,
  };
}
