import "./style.css";
import { Player, Stage, Vector2 } from "@motion-canvas/core";
import project from "./project?project";
import { CUES, FILM, JUMP, sample } from "./model";
document.querySelector("#app")!.innerHTML =
  `<main><header><h1>留下弧线</h1><span>Motion Canvas · 曲线 / 公式 / 重量复用</span></header><div id="stage"></div><div class="transport"><button id="play">播放</button><button id="restart">重播</button><input id="timeline" type="range" min="0" max="18" step="0.0166666667" value="0" aria-label="时间轴"/><output>0.00 / 18.00</output><select id="speed" aria-label="播放速度"><option value="1">1×</option><option value="0.5">0.5×</option><option value="0.25">0.25×</option></select></div><p class="note">技术试片：人物沿解析重力轨迹运动，曲线记录髋部路径，恢复后回看。公式在恒定重力、无空气阻力的假设下作等价变形，τ &gt; 0。它展示模型的推论，不能用来证明自然界的重力定律。网页静音，MP4 导出含原创合成声。<a href="/">打开 Motion Canvas 编辑器</a></p></main>`;
await document.fonts.load('20px "DejaVu Sans"');
await document.fonts.ready;
const player = new Player(project, {
  fps: 60,
  size: new Vector2(1280, 720),
  resolutionScale: 2,
});
// Export owns the clock. Isolate the version-specific seek bridge here.
player.deactivate();
const stage = new Stage();
stage.configure({
  size: new Vector2(1280, 720),
  resolutionScale: 2,
  background: "#080a0d",
});
document.querySelector("#stage")!.append(stage.finalBuffer);
const errors: string[] = [];
player.logger.onLogged.subscribe((e) => {
  if (e.level === "error") errors.push(e.message);
});
await player.playback.recalculate();
let time = 0,
  playhead = 0,
  playing = false,
  queue = Promise.resolve(),
  busy = false;
const timeline = document.querySelector<HTMLInputElement>("#timeline")!;
const button = document.querySelector<HTMLButtonElement>("#play")!;
const output = document.querySelector("output")!;
function stop() {
  playing = false;
  button.textContent = "播放";
}
function frame(t: number): Promise<ReturnType<typeof sample>> {
  if (!Number.isFinite(t) || t < 0 || t > FILM.duration)
    return Promise.reject(new Error("time must be finite and inside scene"));
  const at = Math.min(FILM.duration - 1 / 60, Math.round(t * 60) / 60);
  const work = queue.then(async () => {
    await player.playback.seek(Math.round(at * 60));
    await stage.render(
      player.playback.currentScene,
      player.playback.previousScene,
    );
    if (errors.length) throw new Error(errors.join("\n"));
    time = at;
    timeline.value = String(time);
    output.textContent = `${time.toFixed(2)} / 18.00`;
    return sample(time);
  });
  queue = work.then(
    () => undefined,
    () => undefined,
  );
  return work;
}
const api = {
  info: () => ({
    ...FILM,
    engine: "Motion Canvas 3.17.2",
    resolutionScale: 2,
    cues: CUES,
    transfers: [{ takeoff: JUMP.takeoff, land: JUMP.land, vx: JUMP.vx }],
  }),
  frame(t: number) {
    stop();
    return frame(t);
  },
  async png(t: number) {
    await this.frame(t);
    return stage.finalBuffer.toDataURL("image/png").split(",")[1];
  },
};
(window as unknown as { __MOTION__: typeof api }).__MOTION__ = api;
button.onclick = () => {
  playhead = time;
  playing = !playing;
  button.textContent = playing ? "暂停" : "播放";
};
document.querySelector<HTMLButtonElement>("#restart")!.onclick = () => {
  stop();
  void frame(0).then(() => {
    playhead = 0;
    playing = true;
    button.textContent = "暂停";
  });
};
timeline.oninput = () => {
  stop();
  void frame(Number(timeline.value));
};
let last = performance.now();
function tick(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (playing) {
    playhead = Math.min(
      FILM.duration,
      playhead +
        dt * Number(document.querySelector<HTMLSelectElement>("#speed")!.value),
    );
  }
  if (playing && !busy) {
    busy = true;
    const next = Math.min(FILM.duration, playhead);
    void frame(next).finally(() => {
      busy = false;
    });
    if (next >= FILM.duration - 1 / 60) stop();
  }
  requestAnimationFrame(tick);
}
await frame(0);
requestAnimationFrame(tick);
