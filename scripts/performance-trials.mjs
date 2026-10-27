#!/usr/bin/env node
// Three original animation studies, not replicas or a finished knowledge film.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createCanvas} from '@napi-rs/canvas';
import {body,walk,flight,phase,track,pointMix,metrics} from './character-motion.mjs';
import {save} from './autopilot-core.mjs';
const GROUND=544,FPS=24,DURATION=8,YELLOW='#ffd43b';
function finish(motion,{lean=0,headTilt=0,crouch=0,reach,armSwing=true}={}) {
  const hip=[motion.hip[0],motion.hip[1]+crouch];
  const neck=[hip[0]+57*Math.sin(lean),hip[1]-57*Math.cos(lean)];
  const swing=armSwing ? Math.sin(motion.phase||0)*14*(motion.moving||0):0;
  const armX=[-12-swing,16+swing];
  const hands=armX.map(x=>[neck[0]+x,neck[1]+Math.sqrt(69**2-x*x)]);
  if(reach)for(let i=0;i<2;i++)if(reach[i])hands[i]=pointMix(hands[i],reach[i].target,reach[i].weight);
  return {...body({hip,feet:motion.feet,lean,headTilt,hands,elbows:[-1,1]}),spineBend:2+8*Math.abs(lean),planted:motion.planted,objects:[]};
}
export function trialPose(name,t) {
  const stationary=x=>({hip:[x,GROUND-85],feet:[[x-20,GROUND],[x+20,GROUND]],planted:[true,true]});
  if(name==='01-curiosity') {
    const motion=walk(t,{start:.4,end:2.2,x0:340,x1:565,ground:GROUND});
    const lean=track(t,[[0,.03],[2.2,.07],[2.7,.26],[3.1,.66],[3.6,.73],[4.05,.73],[4.25,.36],[4.55,-.12],[5.1,.05],[6.1,.23],[8,.23]]);
    const crouch=track(t,[[0,0],[2.3,0],[3.1,37],[4.05,37],[4.45,0],[5.4,0],[6.2,8],[8,8]]);
    const weight=track(t,[[0,0],[2.9,0],[3.15,.72],[3.4,.5],[3.85,1],[4.1,1],[4.18,0],[8,0]]);
    const roll=Math.max(0,Math.min(1.4,t-4.1)),ballX=650+200/1.4*roll-100/1.4**2*roll**2;
    const target=[630,520-Math.sqrt(24**2-20**2)];
    const p=finish(motion,{lean,crouch,headTilt:track(t,[[0,0],[2.3,.15],[3.4,.1],[4.5,.3],[8,.3]]),reach:[null,{target,weight}]});
    p.objects=[{id:'ball',type:'circle',x:ballX,y:520,radius:24,color:'#f2f2f2',fill:'#f2f2f2',lineWidth:1}];
    p.contact= t>=3.85 && t<=4.1 ? {joint:'rightHand',target}:null;
    return p;
  }
  if(name==='02-gap') {
    let motion=walk(t,{start:.25,end:1.6,x0:390,x1:490,ground:GROUND});
    let lean=track(t,[[0,.04],[1.6,.12],[2.25,.28],[2.65,-.16],[2.9,.25],[3.25,.5],[3.65,.12],[3.85,-.08],[4.05,.42],[4.6,.02],[5,-.18],[5.4,.02],[8,.04]]);
    let crouch=track(t,[[0,0],[2.3,0],[2.65,25],[2.9,0],[8,0]]),reach=null;
    if(t>=2.9&&t<3.85) {
      const q=(t-2.9)/.95,f=flight(t,{start:2.9,end:3.85,from:[490,459],to:[770,459],gravity:1000});
      const tuck=Math.sin(Math.PI*q)**2;
      motion={hip:f.hip,feet:[[f.hip[0]-20-11*tuck,f.hip[1]+85-41*tuck],[f.hip[0]+20+15*tuck,f.hip[1]+85-36*tuck]],planted:[false,false]};
      const nx=f.hip[0]+57*Math.sin(lean),ny=f.hip[1]-57*Math.cos(lean);
      reach=[{target:[nx-43,ny+25],weight:1},{target:[nx+56,ny+18],weight:1}];
    } else if(t>=3.85&&t<5.4) {
      motion=stationary(770);
      crouch=t<4.45?22*Math.exp(-4*(t-3.85))*Math.sin(Math.PI*Math.min(1,(t-3.85)/.6)):0;
      const weight=phase(t,4.65,4.9)*(1-phase(t,5.15,5.4));
      const nx=motion.hip[0]+57*Math.sin(lean),ny=motion.hip[1]-57*Math.cos(lean)+crouch;
      reach=[{target:[nx-24,ny-11],weight},null];
    } else if(t>=5.4) motion=walk(t,{start:5.4,end:7.4,x0:770,x1:900,ground:GROUND});
    return finish(motion,{lean,crouch,headTilt:track(t,[[0,0],[2.2,.3],[2.7,0],[4.6,-.3],[5.2,-.3],[5.5,0],[8,0]]),reach,armSwing:t<2.3||t>=5.4});
  }
  if(name==='03-weight') {
    const advance=phase(t,4.2,5.5),blockX=700+90*advance;
    let motion=t<4.2?walk(t,{start:.2,end:1.65,x0:440,x1:630,ground:GROUND}):walk(t,{start:4.2,end:5.5,x0:630,x1:720,ground:GROUND});
    const effort=track(t,[[0,0],[1.7,0],[2.3,.65],[2.8,.3],[3.45,1],[5.6,1],[6.25,0],[8,0]]);
    const lean=.04+effort*.59,crouch=effort*36;
    const weight=track(t,[[0,0],[1.8,0],[2.2,1],[5.6,1],[6.05,0],[8,0]]);
    const second=track(t,[[0,0],[2.95,0],[3.5,1],[5.6,1],[6.1,0],[8,0]]);
    const p=finish(motion,{lean,crouch,headTilt:effort*-.16,reach:[{target:[blockX,478],weight:second},{target:[blockX,449],weight}]});
    p.objects=[{id:'block',type:'line',points:[[0,0],[100,0],[100,114],[0,114],[0,0]],x:blockX,y:430,lineWidth:4,color:'#e5e5e5'}];
    p.contact=t>=3.5&&t<=5.6?{joint:'rightHand',target:[blockX,449]}:null;
    return p;
  }
  throw new Error(`Unknown performance trial: ${name}`);
}
function background(file,gap) {
  const c=createCanvas(1280,720),ctx=c.getContext('2d');ctx.fillStyle='#08090b';ctx.fillRect(0,0,1280,720);
  const g=ctx.createLinearGradient(0,GROUND,0,720);g.addColorStop(0,'#292d31');g.addColorStop(1,'#111316');ctx.fillStyle=g;
  if(gap){ctx.fillRect(0,GROUND,560,176);ctx.fillRect(700,GROUND,580,176);}else ctx.fillRect(0,GROUND,1280,176);
  ctx.strokeStyle='#85888b';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(0,GROUND);ctx.lineTo(gap?560:1280,GROUND);if(gap){ctx.lineTo(560,720);ctx.moveTo(700,720);ctx.lineTo(700,GROUND);ctx.lineTo(1280,GROUND)}ctx.stroke();
  fs.writeFileSync(file,c.toBuffer('image/png'));
}
function sound(file,events) {
  const sr=48000,n=DURATION*sr,pcm=new Float64Array(n);let seed=0x451234;
  for(const e of events) {
    const duration=e.kind==='land'?.35:e.kind==='scrape'?.85:.1;
    let low=0;
    for(let i=0;i<duration*sr;i++) {
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;const noise=seed/0x80000000-1;low=.93*low+.07*noise;
      const t=i/sr,envelope=(1-Math.exp(-t*500))*Math.exp(-t/(duration*.2));
      const v=e.kind==='scrape'?low*.12*Math.sin(Math.PI*t/duration)**2:(Math.sin(2*Math.PI*(e.kind==='land'?66:110)*t)*.3+low*.9)*envelope*(e.kind==='land'?.42:.22);
      const j=Math.round(e.time*sr)+i;if(j>=0&&j<n)pcm[j]+=v;
    }
  }
  const out=Buffer.alloc(44+n*2);out.write('RIFF');out.writeUInt32LE(out.length-8,4);out.write('WAVEfmt ',8);out.writeUInt32LE(16,16);out.writeUInt16LE(1,20);out.writeUInt16LE(1,22);out.writeUInt32LE(sr,24);out.writeUInt32LE(sr*2,28);out.writeUInt16LE(2,32);out.writeUInt16LE(16,34);out.write('data',36);out.writeUInt32LE(n*2,40);
  for(let i=0;i<n;i++)out.writeInt16LE(Math.round(Math.tanh(pcm[i])*30000),44+i*2);fs.writeFileSync(file,out);
}
export function makeTrials(destination) {
  const out=path.resolve(destination);
  if(fs.existsSync(out))throw new Error('Trial destination exists; choose a new directory');
  fs.mkdirSync(out,{recursive:true});
  const report={scope:'Three authored action studies; geometric constraints, not full-body physics or reference-level quality certification',trials:{}};
  for(const name of ['01-curiosity','02-gap','03-weight']) {
    const dir=path.join(out,name);fs.mkdirSync(dir);
    const poses=Array.from({length:DURATION*FPS+1},(_,i)=>trialPose(name,i/FPS));
    const layers=[{id:'space',type:'image',path:'space.png',x:0,y:0,w:1280,h:720}];
    const actor={id:'yellow',type:'stick',color:YELLOW,lineWidth:7.5,radius:19,contour:'curved',headFill:'#08090b',joints:poses[0].joints,keys:poses.map((p,i)=>({t:i/FPS,spineBend:p.spineBend})),jointInterpolation:'linear',jointsKeys:poses.map((p,i)=>({t:i/FPS,joints:p.joints}))};
    layers.push(actor);
    for(const object of poses[0].objects) layers.push({...object,keys:poses.map((p,i)=>({t:i/FPS,x:p.objects.find(o=>o.id===object.id).x,y:p.objects.find(o=>o.id===object.id).y}))});
    const events=[];
    for(let i=1;i<poses.length;i++)for(let s=0;s<2;s++)if(poses[i].planted[s]&&!poses[i-1].planted[s]){
      const landing=name==='02-gap'&&i/FPS>3.8&&i/FPS<4;
      if(landing&&s===1)continue;
      events.push({time:i/FPS,kind:landing?'land':'step'});
    }
    if(name==='01-curiosity')events.push({time:4.1,kind:'step'});
    if(name==='03-weight')events.push({time:4.2,kind:'scrape'});
    background(path.join(dir,'space.png'),name==='02-gap');sound(path.join(dir,'foley.wav'),events);
    save(path.join(dir,'project.json'),{version:1,style:'concept',width:1280,height:720,fps:FPS,duration:DURATION,background:'#08090b',grid:false,shots:[{start:0,end:DURATION,camera:{x:0,y:0,zoom:1},layers}],sfx:[{time:0,path:'foley.wav',gain:1}],captions:[]});
    const m=metrics(poses),contacts=poses.filter(p=>p.contact);
    m.max_authored_contact_error=contacts.length?Math.max(...contacts.map(p=>Math.hypot(...p.joints[p.contact.joint].map((v,j)=>v-p.contact.target[j])))):0;
    report.trials[name]={...m,frames:DURATION*FPS,events};
  }
  save(path.join(out,'constraints.json'),report);return out;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try{if(process.argv.length!==3)throw new Error('Usage: node scripts/performance-trials.mjs NEW_OUTPUT_DIRECTORY');console.log(makeTrials(process.argv[2]));}catch(e){console.error(e.message);process.exitCode=1;}
}
