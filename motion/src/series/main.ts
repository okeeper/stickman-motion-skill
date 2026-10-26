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
    "追上载台，登台后反向，承受制动，伏身穿过低梁，再借已有速度跳离。u 是电机目标速度，v 是实际速度；乘以 −1 改变设置，电机用有限加速度执行。",
  "binary-search":
    "带着目标 63，查询升序隐藏值的当前中点。索引 8 → 12 → 14 → 13，保留区间 16 → 8 → 4 → 1。排除只降低候选亮度，原数组及其位置不变。匹配后乘正确升降台抵达出口。",
  "complex-rotation":
    "乘上 ×i 载台，经过四个四分之一圈，取回对侧电芯并恢复出口。旋转的对象是载台中心对应的复数；角色保持直立并对惯性作出反应。中间角度为连续展示，完成后才出现乘法等式。",
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
