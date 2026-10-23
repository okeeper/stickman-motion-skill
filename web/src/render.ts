import { clamp, lerp, type Vec } from './math.js';
import { HIP, type Motion, type Phase, type Preset } from './physics.js';
import { skeleton } from './rig.js';
export const SIZE = { width: 1280, height: 720 };
export const PHASE: Record<Phase, string> = {
  ready: '站稳',
  charge: '蓄力',
  push: '蹬地',
  flight: '腾空',
  absorb: '吸震',
  rebound: '回弹',
  settle: '恢复',
};
export const LABEL: Record<Preset, string> = {
  natural: '01  /  自然跳跃',
  heroic: '02  /  蓄力大跳',
  heavy: '03  /  更重的身体',
};
export function view(m: Motion) {
  const span = Math.max(5.2, m.destination.x + 1.9);
  const scale = Math.min(190, 1080 / span, 455 / (m.origin.y + m.height + 0.78));
  const offset = 110 + (1080 - span * scale) / 2;
  return { scale, point: (v: Vec): Vec => ({ x: offset + v.x * scale, y: 603 - v.y * scale }) };
}
export function draw(
  ctx: CanvasRenderingContext2D,
  m: Motion,
  t: number,
  opts: { debug?: boolean; preset?: Preset; labels?: boolean } = {},
) {
  const s = m.at(t),
    r = skeleton(m, s),
    camera = view(m),
    p = camera.point,
    scale = camera.scale;
  const bg = '#10171c',
    ink = '#f7b955',
    muted = '#71878e',
    mint = '#81d8bc';
  ctx.clearRect(0, 0, 1280, 720);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1280, 720);
  const gradient = ctx.createLinearGradient(0, 500, 0, 720);
  gradient.addColorStop(0, bg);
  gradient.addColorStop(1, '#1a272d');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 440, 1280, 280);
  function line(a: Vec, b: Vec, color: string, width: number) {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  function text(value: string, x: number, y: number, size: number, color = muted) {
    ctx.fillStyle = color;
    ctx.font = `${size}px 'Motion Sans',sans-serif`;
    ctx.fillText(value, x, y);
  }
  line({ x: 70, y: 603 }, { x: 1210, y: 603 }, '#3a4b51', 2);
  for (let x = 0; x <= 8; x += 0.5) {
    const a = p({ x, y: 0 });
    if (a.x > 70 && a.x < 1210) line({ x: a.x, y: 603 }, { x: a.x, y: 610 }, '#2d3f46', 1);
  }
  for (const [x, label] of [
    [1.6, '起跳'],
    [m.destination.x, '落点'],
  ] as const) {
    const a = p({ x, y: 0 });
    text(label, a.x - 15, 642, 15);
    line({ x: a.x, y: 612 }, { x: a.x, y: 618 }, muted, 1);
  }
  const airborneHeight = Math.max(0, s.root.y - HIP),
    shadow = p({ x: s.root.x, y: 0 });
  ctx.save();
  ctx.fillStyle = `rgba(0,0,0,${0.28 / (1 + airborneHeight)})`;
  ctx.beginPath();
  ctx.ellipse(
    shadow.x,
    605,
    (scale * 0.26) / (1 + 0.3 * airborneHeight),
    5 / (1 + 0.3 * airborneHeight),
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.restore();
  // Impact accents are consequences of a recorded collision; they do not drive it.
  for (const event of m.events.filter((e) => e.kind === 'impact')) {
    const dt = t - event.t;
    if (dt < 0 || dt > 0.45) continue;
    const center = p({ x: event.x, y: 0 }),
      alpha = (1 - dt / 0.45) * Math.min(1, event.speed / 5);
    ctx.save();
    ctx.globalAlpha = alpha * 0.55;
    for (const side of [-1, 1])
      for (let i = 0; i < 4; i++) {
        const travel = 15 + i * 9 + dt * (50 + i * 20);
        const x = center.x + side * travel,
          y = 600 - dt * (35 + i * 10) + 100 * dt * dt;
        line({ x, y }, { x: x + side * 5, y: y - 1 }, muted, 1.5);
      }
    ctx.restore();
  }
  function limb(a: Vec, hinge: Vec, b: Vec, color: string, width: number) {
    a = p(a);
    hinge = p(hinge);
    b = p(b);
    const before = lerp(hinge, a, 0.3),
      after = lerp(hinge, b, 0.3);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(before.x, before.y);
    ctx.quadraticCurveTo(hinge.x, hinge.y, after.x, after.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
  const stroke = scale * 0.044;
  limb(r.legs[0].a, r.legs[0].hinge, r.legs[0].b, '#b98b45', stroke);
  limb(r.arms[0].a, r.arms[0].hinge, r.arms[0].b, '#bf9149', stroke);
  limb(r.hip, r.spine, r.shoulder, ink, stroke * 1.12);
  limb(r.legs[1].a, r.legs[1].hinge, r.legs[1].b, ink, stroke);
  for (let i = 0; i < 2; i++)
    line(p(r.feet[i].ankle), p(r.feet[i].toe), i === 0 ? '#b98b45' : ink, stroke * 0.88);
  limb(r.arms[1].a, r.arms[1].hinge, r.arms[1].b, ink, stroke);
  line(p(r.shoulder), p(r.head), ink, stroke * 0.9);
  const head = p(r.head);
  ctx.beginPath();
  ctx.ellipse(head.x, head.y, 0.125 * scale, 0.125 * scale, 0, 0, Math.PI * 2);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.strokeStyle = ink;
  ctx.lineWidth = stroke;
  ctx.stroke();
  if (opts.debug) {
    const root = p(s.root);
    ctx.strokeStyle = mint;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    for (let i = 0; i <= 100; i++) {
      const u = i / 100,
        dt = (m.land - m.takeoff) * u,
        pt = p({
          x: m.origin.x + m.launch.x * dt,
          y: m.origin.y + m.launch.y * dt - 0.5 * m.settings.gravity * dt * dt,
        });
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = mint;
    ctx.beginPath();
    ctx.arc(root.x, root.y, 4, 0, Math.PI * 2);
    ctx.fill();
    const force = clamp(s.force / (m.settings.mass * m.settings.gravity), 0, 8) * 17;
    line(root, { x: root.x, y: root.y + 50 }, '#ed8675', 2);
    if (s.contact) line({ x: root.x + 10, y: 603 }, { x: root.x + 10, y: 603 - force }, mint, 3);
    for (const foot of r.feet) {
      const a = p(foot.toe);
      ctx.beginPath();
      ctx.arc(a.x, a.y, 5, 0, Math.PI * 2);
      ctx.strokeStyle = foot.planted ? mint : '#ed8675';
      ctx.stroke();
    }
    text(`vᵧ ${s.velocity.y.toFixed(2)} m/s`, 82, 137, 17, mint);
    text(
      `N / mg  ${(s.force / (m.settings.mass * m.settings.gravity)).toFixed(2)}`,
      82,
      164,
      17,
      mint,
    );
  }
  if (opts.labels !== false) {
    text(opts.preset ? LABEL[opts.preset] : '动作研究', 72, 69, 25, '#e6ecea');
    text(`${m.settings.mass} kg     ·     ${m.settings.gravity.toFixed(2)} m/s²`, 72, 101, 16);
    ctx.textAlign = 'right';
    text(PHASE[s.phase], 1208, 69, 23, ink);
    text(`${t.toFixed(2)} s`, 1208, 101, 16);
    ctx.textAlign = 'left';
    const phases: [string, number][] = [
      ['蓄力', m.start],
      ['蹬地', m.push],
      ['腾空', m.takeoff],
      ['吸震', m.land],
      ['恢复', Math.min(m.duration - 0.4, m.land + 1.8)],
    ];
    for (let i = 0; i < phases.length; i++) {
      const [label, at] = phases[i];
      const x = 340 + i * 145;
      const active = t >= at && (i === phases.length - 1 || t < phases[i + 1][1]);
      text(label, x, 686, 16, active ? ink : muted);
      if (active) line({ x, y: 696 }, { x: x + 30, y: 696 }, ink, 2);
    }
  }
  return { state: s, rig: r, camera };
}
