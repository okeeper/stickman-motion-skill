import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {twoBone,flight,metrics} from '../scripts/character-motion.mjs';
import {trialPose,makeTrials} from '../scripts/performance-trials.mjs';
const names=['01-curiosity','02-gap','03-weight'];
test('authored studies preserve bone lengths, reachable contacts and planted feet at subframe times',()=>{
  for(const name of names) {
    const poses=Array.from({length:1921},(_,i)=>trialPose(name,i/240));
    const report=metrics(poses);
    assert.ok(report.max_bone_length_error<1e-7,name+JSON.stringify(report));
    assert.ok(report.max_target_error<1e-7,name+JSON.stringify(report));
    assert.ok(report.max_stance_frame_drift<1e-7,name+JSON.stringify(report));
    for(const p of poses) {
      if(p.contact)assert.ok(Math.hypot(...p.joints[p.contact.joint].map((v,i)=>v-p.contact.target[i]))<1e-7);
      for(const side of ['left','right'])assert.ok(p.joints[side+'Foot'][1]<=544+1e-7,'no ground penetration');
      if(name==='03-weight') {
        const block=p.objects[0],head=p.joints.head;
        const dx=Math.max(block.x-head[0],0,head[0]-block.x-100),dy=Math.max(430-head[1],0,head[1]-544);
        assert.ok(Math.hypot(dx,dy)>=19-1e-7,'head must stay outside the block');
      }
    }
  }
});
test('airborne trajectory has constant gravitational acceleration and reaches both anchors',()=>{
  const options={start:1,end:2.2,from:[10,100],to:[220,120],gravity:900};
  assert.deepEqual(flight(1,options).hip,options.from);
  assert.ok(Math.hypot(...flight(2.2,options).hip.map((v,i)=>v-options.to[i]))<1e-7);
  const h=.001,a=flight(1.5-h,options).hip,b=flight(1.5,options).hip,c=flight(1.5+h,options).hip;
  assert.ok(Math.abs((a[0]-2*b[0]+c[0])/h**2)<1e-5);
  assert.ok(Math.abs((a[1]-2*b[1]+c[1])/h**2-900)<1e-5);
  assert.throws(()=>flight(1,{...options,end:1}),/Invalid/);
});
test('unreachable limbs report error without stretching; invalid chains and unknown studies fail',()=>{
  const p=twoBone([0,0],[200,0],30,40);
  assert.ok(Math.abs(Math.hypot(...p.joint)-30)<1e-7);
  assert.ok(Math.abs(Math.hypot(...p.end.map((v,i)=>v-p.joint[i]))-40)<1e-7);
  assert.ok(p.error>129);
  assert.throws(()=>twoBone([0,0],[1,2],-1,40),/Invalid/);
  assert.throws(()=>trialPose('unknown',1),/Unknown/);
});
test('generated studies are portable and never overwrite existing output',t=>{
  const parent=fs.mkdtempSync(path.join(os.tmpdir(),'character-studies-'));t.after(()=>fs.rmSync(parent,{recursive:true,force:true}));
  const dir=makeTrials(path.join(parent,'trials'));
  const original=fs.readFileSync(path.join(dir,names[0],'project.json'));
  assert.throws(()=>makeTrials(dir),/exists/);
  assert.deepEqual(fs.readFileSync(path.join(dir,names[0],'project.json')),original);
  for(const name of names) {
    const project=JSON.parse(fs.readFileSync(path.join(dir,name,'project.json')));
    assert.ok(project.shots[0].layers.find(l=>l.type==='stick').jointsKeys.length>190);
    assert.ok(project.shots[0].layers.every(l=>l.type!=='text'));
    for(const p of ['space.png','foley.wav'])assert.ok(fs.statSync(path.join(dir,name,p)).size>100);
  }
  const command=spawnSync(process.execPath,['scripts/performance-trials.mjs',dir],{encoding:'utf8'});
  assert.notEqual(command.status,0);assert.match(command.stderr,/exists/);
  const file=path.join(dir,names[0],'project.json');
  let validate=spawnSync(process.execPath,['scripts/autopilot.mjs','validate',file],{encoding:'utf8'});
  assert.equal(validate.status,0,validate.stderr);
  const invalid=JSON.parse(fs.readFileSync(file));invalid.shots[0].layers.find(l=>l.type==='stick').contour='rubber';fs.writeFileSync(file,JSON.stringify(invalid));
  validate=spawnSync(process.execPath,['scripts/autopilot.mjs','validate',file],{encoding:'utf8'});
  assert.notEqual(validate.status,0);assert.match(validate.stderr,/Unknown stick contour/);
});
