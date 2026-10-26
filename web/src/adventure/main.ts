import './style.css';
import { CUES, FILM, BOARD, EXIT, storyAt } from './model.js';
import { drawStory } from './render.js';
document.querySelector('#app')!.innerHTML = `
<header><a href="./">STICKMAN / MOTION</a><span>原创概念冒险 · TS 实时预览</span></header>
<main><div class="intro"><h1>借势</h1><p>观察来向，带上因子，借已有速度越过空隙。</p></div>
<section><canvas width="1280" height="720" aria-label="火柴人拿取方向因子、登上移动平台、反向后借势跳离"></canvas>
<div class="transport"><button id="play">播放</button><button id="restart">重播</button><input id="timeline" type="range" min="0" max="28" step="0.0166666667" value="0" aria-label="时间轴"/><output id="time">0.00 / 28.00</output><select id="speed" aria-label="播放速度"><option value="1">1×</option><option value="0.5">0.5×</option><option value="0.25">0.25×</option></select></div>
<div class="caption"><span id="phase"></span><label><input id="debug" type="checkbox"/>接触检查</label></div></section>
<nav><button data-time="2.8">拿取</button><button data-time="6.5">蓄力登台</button><button data-time="11.3">装入因子</button><button data-time="16.1">借势跳离</button><button data-time="20.7">余波</button></nav>
<p class="note">网页为静音动作预览；导出的 MP4 含分层合成声音。d 是平台电机的方向设置，反向后平台通过制动与加速改变实际速度。有声成片保存在仓库 demos/adventure/reversal.mp4。</p></main>`;
const canvas = document.querySelector('canvas')!;
const ctx = canvas.getContext('2d')!;
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
let time = 0,
  playing = false,
  last = performance.now(),
  exportMode = false,
  debug = false;
function render() {
  const f = drawStory(ctx, time, debug);
  $('phase').textContent = f.phase;
  $<HTMLInputElement>('timeline').value = String(time);
  $('time').textContent = `${time.toFixed(2)} / ${FILM.duration.toFixed(2)}`;
  return f;
}
function setPlaying(value: boolean) {
  playing = value;
  exportMode = false;
  $('play').textContent = value ? '暂停' : '播放';
}
$('play').onclick = () => setPlaying(!playing);
$('restart').onclick = () => {
  time = 0;
  setPlaying(true);
  render();
};
$<HTMLInputElement>('timeline').oninput = (e) => {
  time = Number((e.target as HTMLInputElement).value);
  setPlaying(false);
  render();
};
$<HTMLInputElement>('debug').onchange = (e) => {
  debug = (e.target as HTMLInputElement).checked;
  render();
};
document.querySelectorAll<HTMLButtonElement>('[data-time]').forEach(
  (b) =>
    (b.onclick = () => {
      time = Number(b.dataset.time);
      setPlaying(false);
      render();
    }),
);
function tick(now: number) {
  if (!exportMode && playing) {
    time = Math.min(
      FILM.duration,
      time + Math.min(0.1, (now - last) / 1000) * Number($<HTMLSelectElement>('speed').value),
    );
    if (time === FILM.duration) setPlaying(false);
    render();
  }
  last = now;
  requestAnimationFrame(tick);
}
const api = {
  info() {
    return {
      ...FILM,
      cues: CUES.map((c) => {
        const camera = storyAt(c.t).camera;
        return { ...c, pan: Math.max(-0.8, Math.min(0.8, ((c.x - camera.x) / camera.width) * 2)) };
      }),
      transfers: [BOARD, EXIT].map((c) => ({ takeoff: c.takeoff, land: c.land, vx: c.vx })),
    };
  },
  frame(t: number, showDebug = false) {
    if (!Number.isFinite(t)) throw new Error('time must be finite');
    playing = false;
    exportMode = true;
    time = Math.max(0, Math.min(FILM.duration, t));
    debug = showDebug;
    $('play').textContent = '播放';
    $<HTMLInputElement>('debug').checked = debug;
    return render();
  },
  png(t: number) {
    this.frame(t);
    return canvas.toDataURL('image/png').split(',')[1];
  },
  snapshot() {
    return { time, playing, debug, duration: FILM.duration };
  },
};
(window as unknown as { __MOTION__: typeof api }).__MOTION__ = api;
render();
requestAnimationFrame(tick);
