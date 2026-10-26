import type { Project } from "@motion-canvas/core";
import {
  FILMS,
  events,
  sample,
  NEGATIVE_TRANSFERS,
  COMPLEX_TRANSFERS,
  type FilmId,
} from "../../../web/src/series/model";
import { mountPreview } from "../preview";
import { loadAudio } from "../action/audio";
const notes = {
  "negative-ride":
    "从伸手追赶到预判会合。×(−1)改变方向设置，箭头先减速再反向；脚步、失衡、拨片和着台共用事件。",
  "binary-search":
    "从两下敲击追查声音来源。通口展开建立升序，看到63地址后查询8→12→14→13；结尾的手穿过同一空间通路。",
  "complex-rotation":
    "白杆上的i夹片引起意外离地。主角观察、换握并向支点攀移，再借第四次转动翻身回岸；圆弧由实际轨迹逐段留下。",
};
export async function mountFilm(id: FilmId, project: Project) {
  const cues = events(id);
  await mountPreview({
    project,
    film: FILMS[id],
    sample: (t) => sample(id, t),
    info: () => ({
      id,
      cues,
      engine: "Motion Canvas 3.17.2",
      transfers:
        id === "negative-ride"
          ? NEGATIVE_TRANSFERS
          : id === "complex-rotation"
            ? COMPLEX_TRANSFERS
            : [],
    }),
    subtitle: "概念动作短片 · 正常速度 · 接触拟音",
    note: notes[id],
    audio: () => loadAudio(FILMS[id].duration, cues),
  });
  const nav = document.createElement("nav");
  nav.setAttribute("aria-label", "选择短片");
  nav.style.cssText =
    "display:flex;gap:18px;flex-wrap:wrap;margin:12px 0;font-size:14px";
  for (const item of [
    "negative-ride",
    "binary-search",
    "complex-rotation",
  ] as FilmId[]) {
    const a = document.createElement("a");
    a.href = `./${item}.html`;
    a.textContent = FILMS[item].title;
    if (item === id) {
      a.setAttribute("aria-current", "page");
      a.style.color = "#eeeae2";
    }
    nav.append(a);
  }
  document.querySelector("header")!.after(nav);
}
