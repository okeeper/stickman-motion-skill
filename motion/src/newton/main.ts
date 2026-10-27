import project from "../newton-project?project";
import {
  FILM,
  sample,
  events,
  FLIGHTS,
  ROOT_SEQUENCE,
} from "../../../web/src/newton/model";
import { mountPreview } from "../preview";
import { loadAudio } from "../action/audio";
const cues = events();
await mountPreview({
  project,
  film: FILM,
  sample,
  info: () => ({
    id: "newton",
    cues,
    flights: FLIGHTS,
    sequence: ROOT_SEQUENCE,
    engine: "Motion Canvas 3.17.2",
  }),
  subtitle: "牛顿迭代 · 无台词概念动作短片",
  note: "切线向导遵循牛顿迭代，0与1形成循环；按住输入时只编辑起点，放开后从−2重新求值。脚步与接触拟音共用动作事件。",
  audio: () => loadAudio(FILM.duration, cues),
});
