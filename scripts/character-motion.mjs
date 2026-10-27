// Deterministic side-view character constraints. Screen coordinates: +y downward.
// These are geometric pose constraints, not a full dynamics simulator.
export const clamp = x => Math.max(0, Math.min(1, x));
export const ease = x => { const u=clamp(x); return u*u*(3-2*u); };
export const mix = (a,b,u) => a+(b-a)*u;
export const pointMix = (a,b,u) => a.map((v,i)=>mix(v,b[i],u));
export const phase = (t,a,b) => ease((t-a)/(b-a));
export function track(t, keys) {
  if(t<=keys[0][0]) return keys[0][1];
  for(let i=1;i<keys.length;i++) if(t<keys[i][0]) return mix(keys[i-1][1],keys[i][1],phase(t,keys[i-1][0],keys[i][0]));
  return keys.at(-1)[1];
}
export function twoBone(origin, target, upper, lower, bend=1) {
  if(![...origin,...target,upper,lower,bend].every(Number.isFinite) || upper<=0 || lower<=0 || ![-1,1].includes(bend)) throw new Error('Invalid two-bone chain');
  const delta=target.map((v,i)=>v-origin[i]), actual=Math.hypot(...delta);
  const d=Math.max(Math.abs(upper-lower)+1e-5,Math.min(upper+lower-1e-5,actual));
  const unit=actual>1e-8?delta.map(v=>v/actual):[0,1];
  const along=(upper*upper-lower*lower+d*d)/(2*d), height=Math.sqrt(Math.max(0,upper*upper-along*along));
  const end=origin.map((v,i)=>v+unit[i]*d);
  const joint=[origin[0]+unit[0]*along+unit[1]*height*bend,origin[1]+unit[1]*along-unit[0]*height*bend];
  return {joint,end,error:Math.hypot(target[0]-end[0],target[1]-end[1])};
}
export const BONES={torso:57,head:29,upperArm:36,forearm:36,thigh:44,shin:46};
export function body({hip,feet,lean=0,headTilt=0,hands,elbows=[-1,-1],knees=[1,1]}) {
  if(!Array.isArray(hip)||hip.length!==2||!Array.isArray(feet)||feet.length!==2) throw new Error('Body requires hip and two foot targets');
  const neck=[hip[0]+Math.sin(lean)*BONES.torso,hip[1]-Math.cos(lean)*BONES.torso];
  const angle=lean+headTilt,head=[neck[0]+Math.sin(angle)*BONES.head,neck[1]-Math.cos(angle)*BONES.head];
  hands ||= [[neck[0]-22,neck[1]+62],[neck[0]+26,neck[1]+59]];
  const joints={hip,neck,head},errors={};
  for(let i=0;i<2;i++) {
    const side=i?'right':'left';
    const leg=twoBone(hip,feet[i],BONES.thigh,BONES.shin,knees[i]);
    const arm=twoBone(neck,hands[i],BONES.upperArm,BONES.forearm,elbows[i]);
    joints[side+'Knee']=leg.joint;joints[side+'Foot']=leg.end;
    joints[side+'Elbow']=arm.joint;joints[side+'Hand']=arm.end;
    errors[side+'Foot']=leg.error;errors[side+'Hand']=arm.error;
  }
  return {joints,errors};
}
// Feet remain in world coordinates throughout stance. Swing happens one foot at a time.
export function walk(t,{start,end,x0,x1,ground=544}) {
  if(![t,start,end,x0,x1,ground].every(Number.isFinite)||end<=start) throw new Error('Invalid walk interval');
  const u=phase(t,start,end),steps=Math.max(2,2*Math.ceil(Math.abs(x1-x0)/100)),p=u*steps;
  const feet=[],planted=[];
  for(let side=0;side<2;side++) {
    const offset=side?20:-20;let x=x0+offset,y=ground,contact=true;
    for(let step=side;step<steps;step+=2) {
      if(p<=step) break;
      const q=clamp((p-step)/0.72),goal=step>=steps-2?x1+offset:mix(x0,x1,(step+1)/steps)+offset;
      const newX=mix(x,goal,ease(q));
      if(q<1){x=newX;y-=20*Math.sin(Math.PI*q)**2;contact=false;break;}
      x=goal;
    }
    feet.push([x,y]);planted.push(contact);
  }
  const x=mix(x0,x1,u),maxDx=Math.max(...feet.map(f=>Math.abs(f[0]-x)));
  const rise=Math.min(85,Math.sqrt(Math.max(1,89**2-maxDx**2)));
  const moving=Math.sin(Math.PI*u)**0.4;
  return {hip:[x,ground-rise+moving*(1+Math.sin(p*Math.PI*2))],feet,planted,phase:p*Math.PI,moving};
}
export function flight(t,{start,end,from,to,gravity=900}) {
  if(![t,start,end,...from,...to,gravity].every(Number.isFinite)||end<=start||gravity<=0) throw new Error('Invalid ballistic flight');
  const duration=end-start,u=Math.max(0,Math.min(duration,t-start));
  const velocity=[(to[0]-from[0])/duration,(to[1]-from[1])/duration-gravity*duration/2];
  return {hip:[from[0]+velocity[0]*u,from[1]+velocity[1]*u+gravity*u*u/2],velocity:[velocity[0],velocity[1]+gravity*u]};
}
export function metrics(poses) {
  const lengths=[['hip','neck',57],['neck','head',29],...['left','right'].flatMap(s=>[['neck',s+'Elbow',36],[s+'Elbow',s+'Hand',36],['hip',s+'Knee',44],[s+'Knee',s+'Foot',46]])];
  let boneError=0,reachError=0,plantDrift=0,previous=null;
  for(const p of poses) {
    for(const [a,b,length] of lengths) boneError=Math.max(boneError,Math.abs(Math.hypot(...p.joints[a].map((v,i)=>v-p.joints[b][i]))-length));
    reachError=Math.max(reachError,...Object.values(p.errors));
    if(previous)for(let i=0;i<2;i++)if(p.planted?.[i]&&previous.planted?.[i]){const n=(i?'right':'left')+'Foot';plantDrift=Math.max(plantDrift,Math.hypot(...p.joints[n].map((v,j)=>v-previous.joints[n][j])));}
    previous=p;
  }
  return {max_bone_length_error:boneError,max_target_error:reachError,max_stance_frame_drift:plantDrift};
}
