#!/usr/bin/env node
// Adapted from stickman-video-director, Copyright (c) 2026 Stickman Video Director contributors.
// MIT license: ../licenses/stickman-video-director-MIT.txt
import fs from 'node:fs';
import path from 'node:path';
import {ROOT, FFMPEG, FFPROBE, run, probe, loadProject, outputDir, save, json, hashFile, groupWords} from './autopilot-core.mjs';

const [command, ...args] = process.argv.slice(2);
const option = (flag, fallback) => args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback;
const usage = 'Commands: doctor | probe FILE | init DIR | captions WORDS OUTPUT [--lead N] | validate PROJECT [--seconds N] | preview PROJECT [--seconds N] [--replace] | approve PROJECT --note TEXT | render PROJECT [--replace]';
async function main() {
  if (['--help','-h','help'].includes(command)) { console.log(usage); return; }
  if (command === '--version') { console.log(JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'),'utf8')).version); return; }
  if (command === 'doctor') {
    const checks = {node: Number(process.versions.node.split('.')[0]) >= 20};
    for (const [name, exe] of [['ffmpeg', FFMPEG], ['ffprobe', FFPROBE]]) try { run(exe, ['-version']); checks[name] = true; } catch { checks[name] = false; }
    try { await import('@napi-rs/canvas'); checks.canvas = true; } catch { checks.canvas = false; }
    checks.fonts = ['DejaVuSans.ttf', 'NotoSansSC.ttf'].every(f => { const file = path.join(ROOT, 'assets/fonts', f); return fs.existsSync(file) && fs.statSync(file).size > 10000; });
    console.log(JSON.stringify({checks, gemini_key_present: Boolean(process.env.GEMINI_API_KEY), network_checked: false, note: 'Key presence is not quota/billing verification'}, null, 2));
    if (Object.values(checks).some(v => !v)) process.exitCode = 1;
  } else if (command === 'probe') console.log(JSON.stringify(probe(path.resolve(args[0])), null, 2));
  else if (command === 'init') {
    if (!args[0]) throw new Error('Project directory required');
    const dir = path.resolve(args[0]); if (fs.existsSync(dir)) throw new Error('Project directory already exists; will not overwrite');
    if (dir.startsWith(ROOT + path.sep)) throw new Error('Create projects outside the installed Skill');
    fs.mkdirSync(dir, {recursive: true});
    save(path.join(dir, 'project.json'), {version: 1, style: 'concept', width: 1280, height: 720, fps: 24, duration: 10, background: '#050505', captions: [], shots: [], sfx: []});
    console.log(JSON.stringify({project: path.join(dir, 'project.json'), stage: 'scaffold; add authored scenes before rendering'}));
  } else if (command === 'captions') {
    if (!args[0] || !args[1]) throw new Error('Aligned word input and output file required');
    if (fs.existsSync(args[1])) throw new Error('Caption output exists; will not overwrite');
    save(args[1], groupWords(json(args[0]), Number(option('--lead', 0))));
    console.log(JSON.stringify({output: path.resolve(args[1])}));
  } else if (['validate', 'preview', 'approve', 'render'].includes(command)) {
    const scoped = command === 'preview' || command === 'validate' && args.includes('--seconds');
    const seconds = scoped ? Number(option('--seconds', 20)) : undefined;
    if (scoped && (!Number.isFinite(seconds) || seconds <= 0)) throw new Error('Preview length must be greater than 0');
    let p;
    if (command !== 'approve') p = loadProject(args[0], scoped ? {seconds} : {});
    if (command === 'validate') { const {painter} = await import('./autopilot-render.mjs'); const draw = await painter(p); for (const shot of p.shots) draw(Math.min(p.rangeEnd - 0.001, (shot.start + shot.end) / 2)); for (const cue of p.captions) draw(Math.min(p.rangeEnd - 0.001, (cue.start + cue.end) / 2)); console.log(JSON.stringify({valid: true, fingerprint: p.fingerprint, duration: p.duration, checked_seconds: p.rangeEnd, shots: p.shots.length, creative_review: 'not performed'})); return; }
    const base = p?.base ?? path.dirname(fs.realpathSync(path.resolve(args[0])));
    const out = outputDir(p ?? {base, inputs: []}), approvalPath = path.join(out, 'approval.json'), reportPath = path.join(out, 'preview-report.json');
    let report, reviewed;
    if (command === 'approve' || command === 'render' && p.reviewPolicy === 'required') {
      if (command === 'render' && (!fs.existsSync(approvalPath) || !fs.existsSync(reportPath))) throw new Error('Full production requires user-approved preview');
      if (!fs.existsSync(reportPath)) throw new Error('Render and review a preview first');
      report = json(reportPath);
      const error = command === 'render' ? 'Approval invalidated; preview and user approval required again' : 'Preview changed; render/review it again';
      if (!Number.isFinite(report.preview_seconds) || report.preview_seconds <= 0) throw new Error(error);
      reviewed = loadProject(args[0], {seconds: report.preview_seconds});
      outputDir(reviewed);
      if (report.fingerprint !== reviewed.fingerprint || report.output !== path.join(out, 'preview.mp4') || !fs.existsSync(report.output) || hashFile(report.output) !== report.output_sha256) throw new Error(error);
    }
    if (command === 'approve') {
      const note = option('--note', ''); if (!note.trim()) throw new Error('A note recording genuine user approval is required');
      save(approvalPath, {preview_fingerprint: reviewed.fingerprint, preview_seconds: report.preview_seconds, preview_sha256: report.output_sha256, note, approved_at: new Date().toISOString()});
      console.log(JSON.stringify({approval: approvalPath})); return;
    }
    if (command === 'render' && p.reviewPolicy === 'required') {
      const a = json(approvalPath);
      if (a.preview_fingerprint !== reviewed.fingerprint || a.preview_seconds !== report.preview_seconds || a.preview_sha256 !== report.output_sha256) throw new Error('Approval invalidated; preview and user approval required again');
    }
    const {render} = await import('./autopilot-render.mjs'); console.log(JSON.stringify(await render(p, {full: command === 'render', seconds, replace: args.includes('--replace')}), null, 2));
  } else throw new Error(usage);
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
