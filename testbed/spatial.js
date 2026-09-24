// Visual-only coordinates. Labels and recorded stereo audio are not transformed.
// The defender/listener is at (0, 0); +Z points toward the attacking goal.
export const LISTENER_HEIGHT=1.6;
export const BALL_HEIGHT=1.45;
export const ATTACK_Z=8;

export function targetWorldPosition(dataset,target){
  if(dataset==='ring'||dataset==='ring8'){
    const angle=(target.angleClockwiseDeg??target.index*(dataset==='ring8'?45:30))*Math.PI/180;
    const radius=3.1;
    // From the defender's +Z view, screen right is world -X.
    return {x:-radius*Math.sin(angle),y:BALL_HEIGHT,z:radius*Math.cos(angle)};
  }
  const x=-(target.x||0)/4.2*3.4;
  if(dataset==='trajectory')return {x,y:BALL_HEIGHT,z:0};
  // C0 is the listener; the attacker-side 9 m row is 8 visual metres ahead.
  const z=((target.z??-4.5)+4.5)/13.5*ATTACK_Z;
  return {x,y:BALL_HEIGHT,z};
}
