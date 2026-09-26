// Visual-only coordinates. Labels and recorded stereo audio are not transformed.
// The 0-to-9 court label interval occupies eight scene units in the scan.
// Moving six labelled metres back therefore shifts the scene by 8 * 6 / 9.
// +Z points toward the attacking goal. Audio and answer labels are unchanged.
export const LISTENER_HEIGHT=1.6;
export const BALL_HEIGHT=1.0;
const COURT_SPAN=8;
export const DEFENDER_Z=-6*COURT_SPAN/9;
export const ATTACK_Z=DEFENDER_Z+COURT_SPAN;

export function targetWorldPosition(dataset,target){
  if(dataset==='ring'||dataset==='ring8'){
    const angle=(target.angleClockwiseDeg??target.index*(dataset==='ring8'?45:30))*Math.PI/180;
    const radius=3.1;
    // From the defender's +Z view, screen right is world -X.
    return {x:-radius*Math.sin(angle),y:BALL_HEIGHT,z:DEFENDER_Z+radius*Math.cos(angle)};
  }
  const x=-(target.x||0)/4.2*3.4;
  if(dataset==='trajectory')return {x,y:BALL_HEIGHT,z:DEFENDER_Z};
  // C0 is the listener; the attacker-side 9 m row is 8 visual metres ahead.
  const z=DEFENDER_Z+((target.z??-4.5)+4.5)/13.5*COURT_SPAN;
  return {x,y:BALL_HEIGHT,z};
}
