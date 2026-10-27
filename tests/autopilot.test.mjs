import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {createCanvas} from '@napi-rs/canvas';
import {ROOT, FFMPEG, run, save, loadProject, hashFile, probe, groupWords, designPlane} from '../scripts/autopilot-core.mjs';
import {painter, jointState, graphValue} from '../scripts/autopilot-render.mjs';

const cli = path.join(ROOT, 'scripts/autopilot.mjs');
const command = args => spawnSync(process.execPath, [cli, ...args], {encoding:'utf8',timeout:120000});
function fixture(t) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'concept-film-test-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const project=JSON.parse(fs.readFileSync(path.join(ROOT,'examples/concept/project.json'),'utf8'));
  project.width=320;project.height=320;
  const file=path.join(dir,'project.json');save(file,project);return {dir,file,project};
}
function report(dir,name){return JSON.parse(fs.readFileSync(path.join(dir,'output',`${name}-report.json`),'utf8'));}

test('doctor and non-overwriting init; malformed project and missing media fail',t=>{
  const r=command(['doctor']);assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).network_checked,false);
  assert.equal(command(['--help']).status,0);
  const parent=fs.mkdtempSync(path.join(os.tmpdir(),'concept-init-test-'));t.after(()=>fs.rmSync(parent,{recursive:true,force:true}));
  const dir=path.join(parent,'new');assert.equal(command(['init',dir]).status,0);
  assert.notEqual(command(['init',dir]).status,0);
  assert.notEqual(command(['validate',path.join(dir,'project.json')]).status,0);
  const f=fixture(t);f.project.shots[1].start=3.1;save(f.file,f.project);
  let failure=command(['validate',f.file]);assert.notEqual(failure.status,0);assert.match(failure.stderr,/gap|boundary/);
  f.project.shots[1].start=3;f.project.shots[0].layers.push({type:'image',path:'missing.png',x:0,y:0,w:10});save(f.file,f.project);
  failure=command(['preview',f.file,'--seconds','3']);assert.notEqual(failure.status,0);assert.match(failure.stderr,/missing\.png/);
  assert.ok(!fs.existsSync(path.join(f.dir,'output','preview.mp4')));
});

test('aligned Chinese and English captions preserve real word timestamps',()=>{
  const cues=groupWords({words:[{start:0.1,end:0.2,word:'数'},{start:0.2,end:0.3,word:'学'},{start:0.3,end:0.4,word:'。'},{start:0.8,end:1,word:'Hello'},{start:1.1,end:1.3,word:'world.'}]});
  assert.deepEqual(cues,[{start:0.1,end:0.4,text:'数学。'},{start:0.8,end:1.3,text:'Hello world.'}]);
  assert.throws(()=>groupWords({words:[{start:1,end:0.5,word:'坏'}]}));
});

test('keyframed joints, analytic graph and original rendered pixels change over time',async t=>{
  const f=fixture(t),p=loadProject(f.file),stick=p.shots[0].layers.find(l=>l.type==='stick'),wave=p.shots[1].layers.find(l=>l.type==='graph');
  const a=jointState(stick,0).rightHand,b=jointState(stick,1).rightHand,m=jointState(stick,0.5).rightHand;
  assert.notDeepEqual(a,b);assert.ok(m[0]>a[0] && m[0]<b[0]);
  for(const x of [-3,-1,0,1,3]) assert.ok(Math.abs(graphValue(wave.components,x,2))<1e-12);
  assert.ok(graphValue(wave.components,-3,0)>0.9);assert.ok(graphValue(wave.components,3,0)<-0.9);
  const draw=await painter(p),first=Buffer.from(draw(0.1).data()),later=Buffer.from(draw(1.9).data());
  assert.notEqual(hashFile(f.file), '');assert.notDeepEqual(first,later);
});

test('Chinese scene text uses the bundled CJK font without narration',async t=>{
  const f=fixture(t);
  f.project.shots[0].layers=[{type:'text',text:'数学',x:100,y:100,size:100,w:500}];save(f.file,f.project);
  const draw=await painter(loadProject(f.file)), chinese=Buffer.from(draw(0.1).data());
  f.project.shots[0].layers[0].text='□□';save(f.file,f.project);
  const placeholder=Buffer.from((await painter(loadProject(f.file)))(0.1).data());
  assert.notDeepEqual(chinese,placeholder,'CJK characters must not render as empty boxes');
});

test('portrait design coordinates preserve square geometry',async t=>{
  const f=fixture(t);f.project.width=320;f.project.height=640;f.project.grid=false;
  f.project.shots[0].layers=[{type:'line',points:[[0,0],[200,0],[200,200],[0,200],[0,0]],x:100,y:200,lineWidth:4,color:'#ffffff'}];save(f.file,f.project);
  const p=loadProject(f.file);assert.equal(designPlane(p).height,2560);
  const pixels=(await painter(p))(0.02).getContext('2d').getImageData(0,0,320,640).data;
  let x0=320,y0=640,x1=0,y1=0;
  for(let y=0;y<160;y++)for(let x=0;x<130;x++)if(pixels[(y*320+x)*4]>150){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y)}
  assert.ok(x1>x0);assert.ok(Math.abs((x1-x0)-(y1-y0))<=1);
});

test('scoped preview, full rendering, cache reuse, output protection and changed tail',t=>{
  const f=fixture(t);
  let r=command(['preview',f.file,'--seconds','3']);assert.equal(r.status,0,r.stderr);
  assert.equal(report(f.dir,'preview').frames,72);assert.equal(report(f.dir,'preview').original_voice_sha256,null);
  const firstCache=path.join(f.dir,'output','cache',fs.readdirSync(path.join(f.dir,'output','cache')).find(name=>name.endsWith('.mp4')));
  r=command(['render',f.file]);assert.equal(r.status,0,r.stderr);
  let data=report(f.dir,'film');assert.equal(data.frames,144);assert.equal(data.cache_hits,1);assert.equal(data.full_decode,'pass');
  assert.equal(Number(probe(path.join(f.dir,'output','film.mp4')).format.duration),6);
  const original=hashFile(path.join(f.dir,'output','film.mp4'));
  f.project.shots[1].layers.find(l=>l.type==='graph').color='#dddddd';save(f.file,f.project);
  r=command(['render',f.file]);assert.notEqual(r.status,0);assert.match(r.stderr,/exists/);assert.equal(hashFile(path.join(f.dir,'output','film.mp4')),original);
  r=command(['render',f.file,'--replace']);assert.equal(r.status,0,r.stderr);data=report(f.dir,'film');assert.equal(data.cache_hits,1);
  fs.appendFileSync(firstCache,'tampered but still potentially decodable');
  r=command(['render',f.file,'--replace']);assert.equal(r.status,0,r.stderr);
  assert.equal(report(f.dir,'film').cache_hits,1,'tampered first shot must be regenerated while the intact tail is reused');
});

test('preview ignores absent tail media but full film fails until media exists',t=>{
  const f=fixture(t);f.project.shots[1].layers.push({type:'image',path:'later.png',x:0,y:0,w:50});save(f.file,f.project);
  let r=command(['validate',f.file,'--seconds','3']);assert.equal(r.status,0,r.stderr);
  r=command(['preview',f.file,'--seconds','3']);assert.equal(r.status,0,r.stderr);
  r=command(['render',f.file]);assert.notEqual(r.status,0);assert.match(r.stderr,/later\.png/);
  const canvas=createCanvas(8,8);canvas.getContext('2d').fillRect(0,0,8,8);fs.writeFileSync(path.join(f.dir,'later.png'),canvas.toBuffer('image/png'));
  r=command(['render',f.file]);assert.equal(r.status,0,r.stderr);assert.equal(report(f.dir,'film').cache_hits,1);
});

test('preview ignores media and sound scheduled after its range within the current shot',t=>{
  const f=fixture(t);
  f.project.shots[0].layers.push({type:'image',path:'later.png',x:0,y:0,w:50,from:2.5});
  f.project.sfx.push({time:2.5,path:'later.wav',gain:0.1});save(f.file,f.project);
  let r=command(['preview',f.file,'--seconds','2']);assert.equal(r.status,0,r.stderr);
  r=command(['validate',f.file,'--seconds','3']);assert.notEqual(r.status,0);assert.match(r.stderr,/later\.png|later\.wav/);
});

test('optional original-speed narration, timed captions and external sound',t=>{
  const f=fixture(t),wav=path.join(f.dir,'voice.wav'),sound=path.join(f.dir,'hit.wav');
  run(FFMPEG,['-v','error','-f','lavfi','-i','sine=frequency=310:duration=0.85','-y',wav]);
  run(FFMPEG,['-v','error','-f','lavfi','-i','sine=frequency=620:duration=0.1','-y',sound]);
  const original=hashFile(wav);f.project.voice={path:'voice.wav',lead:0.1};f.project.captions=[{start:0.1,end:0.8,text:'A small discovery.'}];f.project.sfx=[{time:1,path:'hit.wav',gain:0.1}];save(f.file,f.project);
  let r=command(['preview',f.file,'--seconds','3']);assert.equal(r.status,0,r.stderr);
  const data=report(f.dir,'preview');assert.equal(data.original_voice_sha256,original);assert.equal(data.caption_count,1);assert.equal(hashFile(wav),original);
  assert.ok(fs.readFileSync(path.join(f.dir,'output','preview.srt'),'utf8').includes('A small discovery.'));
  assert.ok(probe(path.join(f.dir,'output','preview.mp4')).streams.some(s=>s.codec_type==='audio'));
  f.project.voice.speed=0.8;save(f.file,f.project);r=command(['validate',f.file]);assert.notEqual(r.status,0);assert.match(r.stderr,/speech speed/);
});

test('an explicitly requested review gate binds the actual preview and permits tail edits',t=>{
  const f=fixture(t);f.project.reviewPolicy='required';save(f.file,f.project);
  let r=command(['render',f.file]);assert.notEqual(r.status,0);assert.match(r.stderr,/user-approved/);
  r=command(['preview',f.file,'--seconds','3']);assert.equal(r.status,0,r.stderr);
  r=command(['approve',f.file,'--note','Synthetic engineering test only; no real user approval']);assert.equal(r.status,0,r.stderr);
  f.project.shots[1].layers.find(l=>l.type==='graph').color='#eeeeee';save(f.file,f.project);
  r=command(['render',f.file]);assert.equal(r.status,0,r.stderr);
  f.project.shots[0].layers[0].color='#eeeeee';save(f.file,f.project);
  r=command(['render',f.file,'--replace']);assert.notEqual(r.status,0);assert.match(r.stderr,/invalidated/);
});

test('output symlink and unapproved network adapter are rejected',t=>{
  const f=fixture(t),outside=fs.mkdtempSync(path.join(os.tmpdir(),'outside-concept-'));t.after(()=>fs.rmSync(outside,{recursive:true,force:true}));
  fs.symlinkSync(outside,path.join(f.dir,'output'),'dir');
  let r=command(['preview',f.file,'--seconds','3']);assert.notEqual(r.status,0);assert.match(r.stderr,/real project-local/);
  r=spawnSync(process.execPath,[path.join(ROOT,'scripts/gemini-media.mjs'),'image'],{encoding:'utf8'});assert.notEqual(r.status,0);assert.match(r.stderr,/Network disabled/);
});

test('optional image adapter saves native media and refuses a duplicate request',t=>{
  const f=fixture(t),adapter=path.join(ROOT,'scripts/gemini-media.mjs');
  const prompt=path.join(f.dir,'prompt.txt'),out=path.join(f.dir,'image.png');fs.writeFileSync(prompt,'A simple line drawing.');
  const argv=[process.execPath,adapter,'image','--prompt',prompt,'--output',out,'--model','offline-model','--allow-network'];
  const runner=`
    import assert from 'node:assert/strict';
    process.argv=${JSON.stringify(argv)};
    globalThis.fetch=async (url,options)=>{
      assert.equal(url,'https://generativelanguage.googleapis.com/v1beta/models/offline-model:generateContent');
      assert.equal(JSON.parse(options.body).contents[0].parts[0].text,'A simple line drawing.');
      return {ok:true,json:async()=>({candidates:[{content:{parts:[{inlineData:{mimeType:'image/png',data:'iVBORw0KGgo='}}]}}]})};
    };
    await import(${JSON.stringify(pathToFileURL(adapter).href)});
  `;
  const runMock=()=>spawnSync(process.execPath,['--input-type=module','--eval',runner],{encoding:'utf8',env:{...process.env,GEMINI_API_KEY:'offline-synthetic-key'},timeout:10000});
  let r=runMock();assert.equal(r.status,0,r.stderr);assert.equal(fs.readFileSync(out).toString('base64'),'iVBORw0KGgo=');
  assert.equal(JSON.parse(fs.readFileSync(`${out}.request.json`)).status,'complete');
  r=runMock();assert.notEqual(r.status,0);assert.match(r.stderr,/prior request receipt exists|Output or prior request/);
});

test('optional speech adapter sends selected voice and writes a WAV without contacting a provider',t=>{
  const f=fixture(t),adapter=path.join(ROOT,'scripts/gemini-media.mjs');
  const textFile=path.join(f.dir,'narration.txt'),out=path.join(f.dir,'speech.wav');fs.writeFileSync(textFile,'你好，世界。');
  const argv=[process.execPath,adapter,'speech','--text',textFile,'--output',out,'--model','offline-tts','--voice','example','--allow-network'];
  const runner=`
    import assert from 'node:assert/strict';
    process.argv=${JSON.stringify(argv)};
    globalThis.fetch=async (url,options)=>{
      const body=JSON.parse(options.body);
      assert.equal(body.contents[0].parts[0].text,'你好，世界。');
      assert.equal(body.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName,'example');
      return {ok:true,json:async()=>({candidates:[{content:{parts:[{inlineData:{mimeType:'audio/L16;rate=24000',data:'AAAAAA=='}}]}}]})};
    };
    await import(${JSON.stringify(pathToFileURL(adapter).href)});
  `;
  const r=spawnSync(process.execPath,['--input-type=module','--eval',runner],{encoding:'utf8',env:{...process.env,GEMINI_API_KEY:'offline-synthetic-key'},timeout:10000});
  assert.equal(r.status,0,r.stderr);const wav=fs.readFileSync(out);
  assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.readUInt32LE(24),24000);
});
