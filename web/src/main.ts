import './style.css';
import { createMotion, PRESETS, type Preset, type Settings } from './physics.js';
import { draw, PHASE } from './render.js';
const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `<header><a class="brand" href="#"><span class="brand-mark">∿</span> STICKMAN <span>MOTION LAB</span></a><span class="version">STUDY 04 <i></i> 重量与弹性</span></header>
<main><div class="intro"><div><p class="eyebrow">CHARACTER MOTION / 角色动作研究</p><h1>先蓄力，再起跳<span>。</span></h1><p class="subtitle">身体有重量，落地有回响。调整参数，观察同一个动作如何改变。</p></div><span class="tag">实时预览 · 逐帧可查</span></div>
<div class="workspace"><section class="stage-panel"><div class="tabs" role="group" aria-label="动作预设"><button data-preset="natural">01 自然跳跃</button><button data-preset="heroic" class="active">02 蓄力大跳</button><button data-preset="heavy">03 更重的身体</button></div><canvas width="1280" height="720" aria-label="火柴人蓄力、起跳和落地动作预览"></canvas><div class="transport"><button id="play" aria-label="暂停">暂停</button><button id="restart" aria-label="从头播放">↺</button><input id="timeline" type="range" min="0" max="7.5" step="0.0166667" value="0" aria-label="时间轴"/><output id="time">0.00 / 7.50</output><label class="speed-label"><select id="speed" aria-label="播放速度"><option value="1">1× 原速</option><option value="0.5">0.5× 慢放</option><option value="0.25">0.25× 逐动作</option></select></label></div><div class="stage-caption"><span><i class="status-dot"></i><span id="phase">站稳</span></span><label><input id="debug" type="checkbox"/> 显示重心、轨迹与受力</label></div></section>
<aside><div class="panel-heading"><span>动作参数</span><button id="reset">重置</button></div><p class="aside-note">夸张来自更强的蹬地，腾空后仍遵守重力。</p>
<div id="controls"></div><div id="error" role="status"></div><div class="metrics"><div><span>预计腾空高度</span><strong id="height">—</strong></div><div><span>起跳速度</span><strong id="velocity">—</strong></div><div><span>蓄力做功</span><strong id="energy">—</strong></div></div><p class="footnote">这是以身体有效质量驱动、辅以关节表演的动画模型。手脚可以夸张，支撑与动量必须连续。</p></aside></div>
<footer><span>蓄力 → 蹬地 → 重力轨迹 → 落地吸震 → 回弹恢复</span><a href="https://github.com/okeeper/stickman-motion-skill">项目与制作说明 ↗</a></footer></main>`;
const canvas = document.querySelector<HTMLCanvasElement>('canvas')!,
  ctx = canvas.getContext('2d')!;
const controls: [keyof Settings, string, number, number, number, string][] = [
  ['charge', '蓄力时间', 0.5, 1.3, 0.05, 's'],
  ['effort', '发力强度', 0.55, 1.3, 0.05, '×'],
  ['mass', '身体质量', 45, 120, 5, 'kg'],
  ['gravity', '重力', 6, 16, 0.1, 'm/s²'],
  ['elasticity', '落地弹性', 0, 1, 0.05, ''],
];
const controlRoot = document.querySelector('#controls')!;
for (const [key, label, min, max, step, unit] of controls) {
  controlRoot.insertAdjacentHTML(
    'beforeend',
    `<label class="control" for="${key}"><span>${label}</span><output id="${key}-value"></output><input id="${key}" type="range" min="${min}" max="${max}" step="${step}" data-unit="${unit}"/></label>`,
  );
}
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
let preset: Preset = 'heroic',
  settings = { ...PRESETS[preset] },
  motion = createMotion(settings),
  time = 0,
  playing = true,
  debug = false,
  last = performance.now();
let exportMode = false;
function sync() {
  for (const [key, , , , , unit] of controls) {
    $<HTMLInputElement>(key).value = String(settings[key]);
    $(key + '-value').textContent = `${settings[key].toFixed(key === 'mass' ? 0 : 2)} ${unit}`;
  }
  $<HTMLInputElement>('timeline').max = String(motion.duration);
  $('height').textContent = motion.height.toFixed(2) + ' m';
  $('velocity').textContent = motion.launch.y.toFixed(2) + ' m/s';
  $('energy').textContent = Math.round(motion.work) + ' J';
  document
    .querySelectorAll<HTMLButtonElement>('[data-preset]')
    .forEach((el) => el.classList.toggle('active', el.dataset.preset === preset));
}
function render() {
  const info = draw(ctx, motion, time, { debug, preset });
  $('phase').textContent = PHASE[info.state.phase];
  $<HTMLInputElement>('timeline').value = String(time);
  $('time').textContent = `${time.toFixed(2)} / ${motion.duration.toFixed(2)}`;
  return info;
}
function rebuild(next: Settings) {
  try {
    const nextMotion = createMotion(next);
    motion = nextMotion;
    settings = { ...next };
    time = 0;
    $('error').textContent = '';
    sync();
    render();
    return true;
  } catch (e) {
    $('error').textContent = (e as Error).message;
    return false;
  }
}
function select(value: Preset) {
  preset = value;
  rebuild({ ...PRESETS[value] });
}
for (const [key, , , , , unit] of controls) {
  $<HTMLInputElement>(key).addEventListener('input', (e) => {
    const v = Number((e.target as HTMLInputElement).value);
    $(key + '-value').textContent = `${v.toFixed(key === 'mass' ? 0 : 2)} ${unit}`;
    rebuild({ ...settings, [key]: v });
  });
}
document
  .querySelectorAll<HTMLButtonElement>('[data-preset]')
  .forEach((el) => el.addEventListener('click', () => select(el.dataset.preset as Preset)));
$('reset').onclick = () => select(preset);
function setPlaying(v: boolean) {
  playing = v;
  if (v) exportMode = false;
  $('play').textContent = v ? '暂停' : '播放';
  $('play').setAttribute('aria-label', v ? '暂停' : '播放');
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
function tick(now: number) {
  if (!exportMode) {
    if (playing)
      time =
        (time + Math.min(0.1, (now - last) / 1000) * Number($<HTMLSelectElement>('speed').value)) %
        motion.duration;
    render();
  }
  last = now;
  requestAnimationFrame(tick);
}
sync();
render();
requestAnimationFrame(tick);
const api = {
  setPreset(value: Preset) {
    if (!Object.hasOwn(PRESETS, value)) throw new Error('unknown preset');
    select(value);
    return {
      duration: motion.duration,
      events: motion.events,
      settings: motion.settings,
      height: motion.height,
      takeoff: motion.takeoff,
      land: motion.land,
    };
  },
  configure(value: Settings) {
    if (!value || Object.keys(value).some((k) => !Object.hasOwn(PRESETS.natural, k)))
      throw new Error('unknown settings field');
    if (!rebuild(value)) throw new Error($('error').textContent || 'invalid settings');
    return {
      duration: motion.duration,
      events: motion.events,
      settings: motion.settings,
      height: motion.height,
      takeoff: motion.takeoff,
      land: motion.land,
    };
  },
  frame(t: number, showDebug = false) {
    if (!Number.isFinite(t)) throw new Error('time must be finite');
    exportMode = true;
    time = Math.max(0, Math.min(t, motion.duration));
    debug = showDebug;
    $<HTMLInputElement>('debug').checked = debug;
    setPlaying(false);
    return render();
  },
  png(t: number) {
    this.frame(t);
    return canvas.toDataURL('image/png').split(',')[1];
  },
  snapshot() {
    return {
      time,
      playing,
      preset,
      settings,
      duration: motion.duration,
      phase: motion.at(time).phase,
    };
  },
};
(window as unknown as { __MOTION__: typeof api }).__MOTION__ = api;
