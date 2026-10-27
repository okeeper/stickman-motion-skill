// Adapted from stickman-video-director, Copyright (c) 2026 Stickman Video Director contributors.
// MIT license: ../licenses/stickman-video-director-MIT.txt
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const FFMPEG = process.env.FFMPEG || 'ffmpeg';
export const FFPROBE = process.env.FFPROBE || 'ffprobe';
export const sha = value => crypto.createHash('sha256').update(value).digest('hex');
export const hashFile = file => sha(fs.readFileSync(file));
export const json = file => JSON.parse(fs.readFileSync(file, 'utf8'));
export function save(file, value) {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n');
  fs.renameSync(tmp, file);
}
export function run(exe, args) {
  const result = spawnSync(exe, args, {encoding: 'utf8', maxBuffer: 8 * 1024 * 1024});
  if (result.error || result.status !== 0) throw new Error(`${path.basename(exe)} failed: ${result.error?.message || result.stderr?.slice(-2400)}`);
  return result.stdout;
}
export function probe(file) {
  return JSON.parse(run(FFPROBE, ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', file]));
}
// Derived from stickman-video-director (MIT); see licenses/stickman-video-director-MIT.txt.
export function mediaPath(base, file) {
  if (typeof file !== 'string' || !file || /^(?:[a-z]+:|\/\/)/i.test(file.replace(/^[A-Z]:[\\/]/i, ''))) throw new Error('Media must be a local path');
  const target = path.resolve(base, file);
  if (!fs.statSync(target).isFile()) throw new Error(`Missing file: ${file}`);
  return fs.realpathSync(target);
}
const number = (x, name, min = 0, max = Infinity) => {
  if (!Number.isFinite(x) || x < min || x > max) throw new Error(`Invalid ${name}`);
  return x;
};
export function fontPaths(project) {
  return {
    hand: project.font ? mediaPath(project.base, project.font) : path.join(ROOT, 'assets/fonts/DejaVuSans.ttf'),
    caption: project.captionFont ? mediaPath(project.base, project.captionFont) : path.join(ROOT, 'assets/fonts/NotoSansSC.ttf'),
  };
}
export function designPlane(project) {
  return {width: 1280, height: 1280 * project.height / project.width};
}
const jointNames = ['head','neck','hip','leftElbow','leftHand','rightElbow','rightHand','leftKnee','leftFoot','rightKnee','rightFoot'];
function validateJoints(joints, label) {
  if (!joints || typeof joints !== 'object') throw new Error(`${label} requires joints`);
  if (Object.keys(joints).length !== jointNames.length || Object.keys(joints).some(name => !jointNames.includes(name))) throw new Error(`${label}: unexpected joints`);
  for (const name of jointNames) {
    const pt = joints[name];
    if (!Array.isArray(pt) || pt.length !== 2) throw new Error(`${label}: missing joint ${name}`);
    for (const n of pt) number(n, `${label}.${name}`, -10000, 10000);
  }
}
function validateKeys(keys, span, name, properties) {
  if (keys === undefined) return;
  if (!Array.isArray(keys)) throw new Error(`${name} must be an array`);
  let previous = -1;
  for (const k of keys) {
    number(k.t, `${name} time`, 0, span);
    if (k.t <= previous) throw new Error(`${name} times must increase`);
    previous = k.t;
    for (const prop of Object.keys(k)) {
      if (prop === 't') continue;
      if (!properties.includes(prop)) throw new Error(`Unsupported ${name} property: ${prop}`);
      number(k[prop], `${name}.${prop}`, -10000, 10000);
      if (['alpha', 'progress'].includes(prop) && (k[prop] < 0 || k[prop] > 1)) throw new Error(`Invalid ${name}.${prop}`);
      if (['w','h','scale','zoom','radius'].includes(prop) && k[prop] <= 0) throw new Error(`Invalid ${name}.${prop}`);
    }
  }
}
export function loadProject(file, {seconds} = {}) {
  file = fs.realpathSync(path.resolve(file));
  const p = json(file), base = path.dirname(file);
  if (p.version !== 1 || p.style !== 'concept') throw new Error('Expected version 1 and style concept');
  if (p.reviewPolicy !== undefined && !['none','required'].includes(p.reviewPolicy)) throw new Error('reviewPolicy must be none or required');
  number(p.width, 'width', 256, 3840); number(p.height, 'height', 256, 3840); number(p.fps, 'fps', 12, 60);
  if (![p.width, p.height, p.fps].every(Number.isInteger) || p.width % 2 || p.height % 2) throw new Error('Even integer dimensions and integer fps required');
  number(p.duration, 'duration', 0.01, 86400);
  if (Math.abs(p.duration * p.fps - Math.round(p.duration * p.fps)) > 1e-5) throw new Error('Duration must align with a frame');
  if (seconds !== undefined) number(seconds, 'preview length', 0.001, 86400);
  const duration = p.duration, rangeEnd = Math.min(duration, seconds ?? duration), scoped = seconds !== undefined;
  if (!Array.isArray(p.shots) || !p.shots.length) throw new Error('Shots required');
  const shots = scoped ? p.shots.filter(s => s.start < rangeEnd).map(s => ({...s, layers: Array.isArray(s.layers) ? s.layers.filter(l => s.start + (l.from ?? 0) < rangeEnd) : s.layers})) : p.shots;
  if (!shots.length) throw new Error('Shots required in the preview range');
  let end = 0;
  const assets = new Set();
  const types = new Set(['image', 'stick', 'text', 'line', 'arrow', 'circle', 'graph']);
  for (const [i, shot] of shots.entries()) {
    number(shot.start, 'shot start'); number(shot.end, 'shot end', 0, duration);
    if (Math.abs(shot.start - end) > 1e-6 || shot.end <= shot.start) throw new Error(`Shot ${i}: gap/overlap or nonpositive duration`);
    for (const time of [shot.start,shot.end]) if (Math.abs(time*p.fps-Math.round(time*p.fps)) > 1e-5) throw new Error(`Shot ${i}: boundary must align with a frame`);
    end = shot.end;
    const span = shot.end - shot.start;
    if (shot.camera) {
      if (typeof shot.camera !== 'object' || Array.isArray(shot.camera)) throw new Error('Camera must be an object');
      for (const key of ['x','y','zoom']) if (shot.camera[key] !== undefined) number(shot.camera[key], `camera ${key}`, key === 'zoom' ? 0.05 : -10000, 10000);
      validateKeys(shot.camera.keys, span, 'camera keys', ['x','y','zoom']);
    }
    if (!Array.isArray(shot.layers) || !shot.layers.length) throw new Error(`Shot ${i} has no layers`);
    const ids = new Set();
    for (const l of shot.layers) {
      if (!l || !types.has(l.type)) throw new Error(`Unknown layer ${l?.type}`);
      if (l.id !== undefined) {
        if (typeof l.id !== 'string' || !l.id.trim() || ids.has(l.id)) throw new Error('Layer IDs must be unique, nonempty strings within a shot');
        ids.add(l.id);
      }
      for (const k of ['x','y','w','h','size','angle','alpha','progress','lineWidth','scale','radius','spineBend']) if (l[k] !== undefined) number(l[k], k, -10000, 10000);
      for (const k of ['w','h','size','lineWidth','scale','radius']) if (l[k] !== undefined && l[k] <= 0) throw new Error(`Invalid ${k}`);
      for (const k of ['alpha','progress']) if (l[k] !== undefined && (l[k] < 0 || l[k] > 1)) throw new Error(`Invalid ${k}`);
      if (l.type === 'image') { const f = mediaPath(base, l.path); if (!/\.(png|jpe?g|webp)$/i.test(f)) throw new Error('Only PNG/JPEG/WebP image layers'); assets.add(f); }
      if (l.type === 'text' && (typeof l.text !== 'string' || !l.text.trim() || l.text.length > 400)) throw new Error('Text layer must be 1–400 characters');
      if (l.type === 'text' && l.font !== undefined && !['math','cjk'].includes(l.font)) throw new Error('Text font must be math or cjk');
      if (l.type === 'line' && (!Array.isArray(l.points) || l.points.length < 2 || l.points.some(pt => !Array.isArray(pt) || pt.length !== 2 || pt.some(n => !Number.isFinite(n))))) throw new Error('Line requires finite [x,y] points');
      if (l.type === 'stick') {
        validateJoints(l.joints, 'stick');
        if(l.contour!==undefined && !['straight','curved'].includes(l.contour)) throw new Error('Unknown stick contour');
        if (l.jointInterpolation !== undefined && !['linear','smooth'].includes(l.jointInterpolation)) throw new Error('Unknown joint interpolation');
        if (l.jointsKeys !== undefined && !Array.isArray(l.jointsKeys)) throw new Error('jointsKeys must be an array');
        let last = -1;
        for (const k of l.jointsKeys || []) { number(k.t, 'joints time', 0, span); if (k.t <= last) throw new Error('Joint key times must increase'); last = k.t; validateJoints(k.joints, 'joint key'); }
      }
      if (l.type === 'graph') {
        if (!Array.isArray(l.domain) || l.domain.length !== 2 || !l.domain.every(Number.isFinite) || l.domain[0] >= l.domain[1]) throw new Error('Graph domain must increase');
        number(l.yScale ?? 1, 'graph yScale', 0.001, 10000);
        if (!Array.isArray(l.components) || !l.components.length) throw new Error('Graph needs components');
        for (const c of l.components) {
          if (c.kind !== 'gaussian') throw new Error('Only gaussian graph components are supported');
          for (const k of ['amplitude','center','velocity']) number(c[k], `graph ${k}`, -10000, 10000);
          number(c.sigma, 'graph sigma', 0.001, 10000);
        }
      }
      number(l.from ?? 0, 'layer from', 0, span); number(l.to ?? span, 'layer to', l.from ?? 0, span);
      validateKeys(l.keys, span, 'layer keys', ['x','y','w','h','angle','alpha','progress','scale','radius','spineBend']);
    }
  }
  if (scoped ? end < rangeEnd - 1e-6 : Math.abs(end - duration) > 1e-6) throw new Error(`Shots end at ${end}; ${scoped ? 'preview range' : 'film'} ends at ${rangeEnd.toFixed(3)}`);
  let cueEnd = 0;
  if (p.captions !== undefined && !Array.isArray(p.captions)) throw new Error('captions must be an array');
  const captions = scoped ? (p.captions || []).filter(c => c.start < rangeEnd) : p.captions || [];
  for (const cue of captions) {
    number(cue.start, 'caption start', cueEnd, duration); number(cue.end, 'caption end', cue.start + 0.01, duration);
    if (typeof cue.text !== 'string' || !cue.text.trim() || cue.text.length > 240) throw new Error('Invalid caption text');
    cueEnd = cue.end;
  }
  if (p.captionSize !== undefined) number(p.captionSize, 'caption size', 20, 100);
  let voicePath = null, voiceDuration = null, lead = 0;
  if (p.voice !== undefined && p.voice !== null) {
    if (typeof p.voice !== 'object' || Object.keys(p.voice).some(k => !['path','lead','contains_sfx'].includes(k))) throw new Error('Voice supports path/lead/contains_sfx only; speech speed cannot be changed');
    voicePath = mediaPath(base, p.voice.path); const info = probe(voicePath);
    if (!info.streams.some(s => s.codec_type === 'audio')) throw new Error('Narration has no audio stream');
    voiceDuration = number(Number(info.format.duration), 'voice duration', 0.01, 86400);
    lead = number(p.voice.lead ?? 0, 'lead', 0, duration);
    if (lead + voiceDuration > duration + 0.06) throw new Error('Voice extends beyond film duration');
    assets.add(voicePath);
  }
  if (p.sfx !== undefined && !Array.isArray(p.sfx)) throw new Error('sfx must be an array');
  const sfx = scoped ? (p.sfx || []).filter(s => s.time < rangeEnd) : p.sfx || [];
  if (p.voice?.contains_sfx && sfx.length) throw new Error('Already mixed voice must not receive duplicate SFX');
  for (const s of sfx) {
    number(s.time, 'SFX time', 0, duration); number(s.gain, 'SFX gain', 0, 1);
    if (s.path) { const f=mediaPath(base,s.path); if (!probe(f).streams.some(x=>x.codec_type==='audio')) throw new Error('SFX file has no audio'); assets.add(f); }
    else if (!['tap','paper','pop','chime'].includes(s.kind)) throw new Error('Unknown SFX');
  }
  if (p.music) { const f=mediaPath(base,p.music.path); if (!probe(f).streams.some(x=>x.codec_type==='audio')) throw new Error('Music file has no audio'); assets.add(f); number(p.music.gain, 'music gain', 0, 1); }
  const timeline = {...p, shots, captions, sfx};
  const project = {...timeline, file, base, voicePath, voiceDuration, lead, duration, rangeEnd};
  for (const f of Object.values(fontPaths(project))) { if (!fs.existsSync(f)) throw new Error(`Missing font: ${f}`); assets.add(f); }
  const inputs = [...assets].sort().map(f => ({path: f, sha256: hashFile(f)}));
  const engine = ['autopilot-core.mjs', 'autopilot-render.mjs'].map(f => hashFile(path.join(ROOT, 'scripts', f)));
  return {...project, inputs, fingerprint: sha(JSON.stringify({project: timeline, rangeEnd, inputs, engine}))};
}
export function outputDir(p) {
  const output = path.join(p.base, 'output');
  if (fs.existsSync(output) && (fs.lstatSync(output).isSymbolicLink() || !fs.statSync(output).isDirectory())) throw new Error('Output must be a real project-local directory');
  fs.mkdirSync(output, {recursive: true});
  function inspect(dir) {
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
      if (entry.isSymbolicLink()) throw new Error('Renderer-owned output must not contain symlinks');
      if (entry.isDirectory()) inspect(path.join(dir, entry.name));
    }
  }
  inspect(output);
  // Never allow an input file to be inside a renderer-owned output directory.
  if (p.inputs.some(i => i.path.startsWith(fs.realpathSync(output) + path.sep))) throw new Error('Input assets cannot live in output/');
  return output;
}
export function groupWords(data, lead = 0) {
  number(lead, 'caption lead', 0, 5);
  if (!Array.isArray(data.words) || !data.words.length) throw new Error('Aligned words required');
  const cues = []; let words = [], start, end = 0;
  function joined(items) {
    return items.join(' ').replace(/(?<=[\u3400-\u9fff，。！？；：、])\s+(?=[\u3400-\u9fff，。！？；：、])/gu, '').replace(/\s+([,.!?;:，。！？；：、])/g, '$1');
  }
  function flush() { if (words.length) cues.push({start: start + lead, end: end + lead, text: joined(words)}); words = []; }
  for (const w of data.words) {
    number(w.start, 'word start', end); number(w.end, 'word end', w.start + 0.001);
    if (typeof w.word !== 'string' || !w.word.trim()) throw new Error('Empty word');
    if (words.length && (w.start - end > 0.4 || words.length >= 8 || w.end - start > 3.5 || joined([...words, w.word]).length > 58)) flush();
    if (!words.length) start = w.start;
    words.push(w.word.trim()); end = w.end;
    if (/[.!?。！？]$/.test(w.word)) flush();
  }
  flush(); return cues;
}
