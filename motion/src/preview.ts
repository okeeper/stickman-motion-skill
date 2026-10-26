import "./style.css";
import { Player, Stage, Vector2, type Project } from "@motion-canvas/core";
interface Film {
  title: string;
  duration: number;
  width: number;
  height: number;
}
interface PCM {
  left: Float32Array<ArrayBuffer>;
  right: Float32Array<ArrayBuffer>;
  sampleRate: number;
}
interface Options<S> {
  project: Project;
  film: Film;
  sample: (t: number) => S;
  info: () => Record<string, unknown>;
  subtitle: string;
  note: string;
  audio?: () => Promise<PCM>;
}
/** One version-pinned seek bridge shared by the action and mathematical studies. */
export async function mountPreview<S>({
  project,
  film,
  sample,
  info,
  subtitle,
  note,
  audio,
}: Options<S>) {
  document.querySelector("#app")!.innerHTML =
    `<main><header><h1>${film.title}</h1><span>${subtitle}</span></header><div id="stage"></div><div class="transport"><button id="play">播放</button><button id="restart">重播</button><input id="timeline" type="range" min="0" max="${film.duration}" step="0.0166666667" value="0" aria-label="时间轴"/><output></output><select id="speed" aria-label="播放速度"><option value="1">1×</option><option value="0.5">0.5×</option><option value="0.25">0.25×</option></select>${audio ? '<button id="sound">声音：开</button>' : ""}</div><p class="note">${note} <a href="/">编辑器</a> · <a href="./action.html">连续动作</a> · <a href="./preview.html">数学图形</a></p></main>`;
  await document.fonts.load('20px "DejaVu Sans"');
  await document.fonts.ready;
  const size = new Vector2(film.width, film.height),
    player = new Player(project, { fps: 60, size, resolutionScale: 2 });
  player.deactivate();
  const stage = new Stage();
  stage.configure({ size, resolutionScale: 2, background: "#080a0d" });
  document.querySelector("#stage")!.append(stage.finalBuffer);
  const errors: string[] = [];
  player.logger.onLogged.subscribe((e) => {
    if (e.level === "error") errors.push(e.message);
  });
  await player.playback.recalculate();
  const slider = document.querySelector<HTMLInputElement>("#timeline")!,
    button = document.querySelector<HTMLButtonElement>("#play")!,
    output = document.querySelector("output")!,
    speedInput = document.querySelector<HTMLSelectElement>("#speed")!;
  let time = 0,
    playing = false,
    queue = Promise.resolve(),
    busy = false,
    playOrigin = 0,
    startedAt = 0,
    enabled = true;
  let context: AudioContext | undefined,
    source: AudioBufferSourceNode | undefined,
    buffer: AudioBuffer | undefined;
  let audioPromise: Promise<PCM> | undefined;
  const clock = () =>
    context ? context.currentTime : performance.now() / 1000;
  function stopSource() {
    source?.stop();
    source = undefined;
  }
  function stop() {
    playing = false;
    button.textContent = "播放";
    stopSource();
  }
  async function frame(t: number): Promise<S> {
    if (!Number.isFinite(t) || t < 0 || t > film.duration)
      throw new Error("time must be finite and inside scene");
    const at = Math.min(film.duration - 1 / 60, Math.round(t * 60) / 60);
    const work = queue.then(async () => {
      await player.playback.seek(Math.round(at * 60));
      await stage.render(
        player.playback.currentScene,
        player.playback.previousScene,
      );
      if (errors.length) throw new Error(errors.join("\n"));
      time = at;
      slider.value = String(time);
      output.textContent = `${time.toFixed(2)} / ${film.duration.toFixed(2)}`;
      return sample(time);
    });
    queue = work.then(
      () => undefined,
      () => undefined,
    );
    return work;
  }
  async function start() {
    if (time >= film.duration - 1 / 60) await frame(0);
    if (audio && enabled) {
      context ??= new AudioContext({ sampleRate: 48000 });
      await context.resume();
      button.textContent = "加载声音…";
      const pcm = await (audioPromise ??= audio());
      if (!buffer) {
        buffer = context.createBuffer(2, pcm.left.length, pcm.sampleRate);
        buffer.copyToChannel(pcm.left, 0);
        buffer.copyToChannel(pcm.right, 1);
      }
      stopSource();
      source = context.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = Number(speedInput.value);
      source.connect(context.destination);
      source.start(0, time);
    }
    playOrigin = time;
    startedAt = clock();
    playing = true;
    button.textContent = "暂停";
  }
  const api = {
    info: () => ({ ...film, ...info(), resolutionScale: 2 }),
    frame(t: number) {
      stop();
      return frame(t);
    },
    async png(t: number) {
      await this.frame(t);
      return stage.finalBuffer.toDataURL("image/png").split(",")[1];
    },
    snapshot: () => ({
      time,
      playing,
      speed: Number(speedInput.value),
      sound: !!audio && enabled,
      audioReady: !!buffer,
    }),
  };
  (window as unknown as { __MOTION__: typeof api }).__MOTION__ = api;
  button.onclick = () => {
    if (playing) stop();
    else void start();
  };
  document.querySelector<HTMLButtonElement>("#restart")!.onclick = () => {
    stop();
    void frame(0).then(start);
  };
  slider.oninput = () => {
    stop();
    void frame(Number(slider.value));
  };
  speedInput.onchange = () => {
    if (playing) {
      stop();
      void start();
    }
  };
  const sound = document.querySelector<HTMLButtonElement>("#sound");
  if (sound)
    sound.onclick = () => {
      const resume = playing;
      stop();
      enabled = !enabled;
      sound.textContent = enabled ? "声音：开" : "声音：关";
      if (resume) void start();
    };
  function tick() {
    if (playing && !busy) {
      busy = true;
      const next = Math.min(
        film.duration,
        playOrigin + (clock() - startedAt) * Number(speedInput.value),
      );
      void frame(next).finally(() => {
        busy = false;
      });
      if (next >= film.duration - 1 / 60) stop();
    }
    requestAnimationFrame(tick);
  }
  await frame(0);
  requestAnimationFrame(tick);
  return api;
}
