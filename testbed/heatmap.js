const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp=v=>Math.max(0,Math.min(1,v));
const color=v=>{const t=clamp(v),a=t<.5?[22,111,236]:[255,219,54],b=t<.5?[255,219,54]:[239,57,39],f=t<.5?t*2:(t-.5)*2;return a.map((n,i)=>Math.round(n+(b[i]-n)*f));};
const ringPos=t=>{const a=(t.angleClockwiseDeg||0)*Math.PI/180;return{x:450+208*Math.sin(a),y:318-208*Math.cos(a)}};
const courtPos=t=>({x:({L:294,C:450,R:606})[t.side]??450,y:({'9':144,'6':226,'3':308,'0':390,'-3':472})[String(t.row)]??390});
const trajectoryPos=(t,stage)=>{const end=({FL:276,NL:363,C:450,NR:537,FR:624})[t.label]??450,q=stage/3;return{x:450+(end-450)*q,y:142+330*q}};

function fieldImage(points,dataset){
  if(!points.length)return '';
  const canvas=document.createElement('canvas');canvas.width=450;canvas.height=320;
  const context=canvas.getContext('2d'),image=context.createImageData(canvas.width,canvas.height),pixels=image.data;
  const ring=dataset==='ring'||dataset==='ring8',sigma=ring?42:dataset==='court'?36:30,sx=sigma,sy=sigma;
  const base=[28,68,92];
  for(let py=0;py<canvas.height;py++)for(let px=0;px<canvas.width;px++){
    const x=px*2+1,y=py*2+1,inside=ring?(x-450)**2+(y-318)**2<=208**2:x>=220&&x<=680&&y>=91&&y<=547;
    if(!inside)continue;
    let total=0,weighted=0;
    for(const point of points){const dx=(x-point.x)/sx,dy=(y-point.y)/sy,distance=dx*dx+dy*dy,w=distance>9?0:Math.exp(-.5*distance);total+=w;weighted+=w*point.value;}
    const coverage=1-Math.exp(-total/.6),mapped=color(total?weighted/total:0),offset=(py*canvas.width+px)*4;
    for(let channel=0;channel<3;channel++)pixels[offset+channel]=Math.round(base[channel]*(1-coverage)+mapped[channel]*coverage);
    pixels[offset+3]=225;
  }
  context.putImageData(image,0,0);
  return `<image href="${canvas.toDataURL('image/png')}" x="0" y="0" width="900" height="640" preserveAspectRatio="none"/>`;
}

function ringFrame(targets){
  const spokes=targets.map(t=>{const p=ringPos(t);return `<line x1="450" y1="318" x2="${p.x}" y2="${p.y}" stroke="#42677d" stroke-width="1" stroke-dasharray="5 7"/>`}).join('');
  const labels=targets.map(t=>{const p=ringPos(t);return `<g><circle cx="${p.x}" cy="${p.y}" r="22" fill="#16364a" stroke="#73cddd" stroke-width="1.5"/><text x="${p.x}" y="${p.y+5}" text-anchor="middle" fill="#f1f8fb" font-size="15" font-weight="700">${esc(t.angleClockwiseDeg)}°</text></g>`}).join('');
  return `<circle cx="450" cy="318" r="208" fill="#112a3c" stroke="#628aa1" stroke-width="2"/><g data-heat-layer></g><circle cx="450" cy="318" r="116" fill="none" stroke="#557a91" stroke-dasharray="5 9"/>${spokes}${labels}<circle cx="450" cy="318" r="31" fill="#0a2031" stroke="#83dce8" stroke-width="2"/><text x="450" y="323" text-anchor="middle" fill="#fff" font-size="15" font-weight="700">청취자</text><text x="450" y="71" text-anchor="middle" fill="#a9d9e7" font-size="18" font-weight="700">정면 · 0°</text><text x="450" y="583" text-anchor="middle" fill="#a9d9e7" font-size="16">뒤 · 180°</text>`;
}
function courtBase(){
  return `<rect x="205" y="76" width="490" height="486" rx="8" fill="#183849" stroke="#77adbf" stroke-width="3"/><rect x="220" y="91" width="460" height="456" rx="2" fill="#c59d71" fill-opacity=".3" stroke="#c9dbe0" stroke-width="2"/><g data-heat-layer></g><path d="M220 173H680 M220 255H680 M220 337H680 M220 419H680 M220 501H680 M450 91V547" fill="none" stroke="#b5d0d6" stroke-opacity=".65" stroke-width="1.5"/><path d="M205 67H695 M205 571H695" stroke="#9eddeb" stroke-width="7" stroke-linecap="round"/><text x="450" y="52" text-anchor="middle" fill="#d8edf2" font-size="18">공격자 골대</text><text x="450" y="608" text-anchor="middle" fill="#d8edf2" font-size="18">수비자 골대</text>`;
}
function courtFrame(targets){
  const labels=targets.map(t=>{const p=courtPos(t);return `<g><circle cx="${p.x}" cy="${p.y}" r="20" fill="#123145" stroke="#9ed5de" stroke-width="1.5"/><text x="${p.x}" y="${p.y+5}" text-anchor="middle" fill="#f4f9fb" font-size="15" font-weight="700">${esc(t.label)}</text></g>`}).join('');
  return `${courtBase()}${labels}<text x="450" y="366" text-anchor="middle" fill="#f2fbfd" font-size="14" font-weight="700">청취자 C0</text>`;
}
function trajectoryFrame(){
  const paths=Object.entries({FL:276,NL:363,C:450,NR:537,FR:624}).map(([label,x])=>`<path d="M450 142L${x} 472" fill="none" stroke="#9dc9d5" stroke-opacity=".68" stroke-width="2" stroke-dasharray="8 8"/><text x="${x}" y="510" text-anchor="middle" fill="#f4f9fb" font-size="17" font-weight="700">${label}</text>`).join('');
  const stages=[1,2,3].map(stage=>{const y=142+330*stage/3;return `<line x1="220" y1="${y}" x2="680" y2="${y}" stroke="#c2d8db" stroke-opacity=".34" stroke-dasharray="6 6"/><text x="186" y="${y+5}" text-anchor="end" fill="#d8edf2" font-size="17">${stage}/3</text>`}).join('');
  return `${courtBase()}${stages}${paths}<circle cx="450" cy="142" r="11" fill="#f1f8fb"/><text x="450" y="125" text-anchor="middle" fill="#f1f8fb" font-size="15">투구 시작</text>`;
}

export function heatmapSvg(rows,dataset,targets,metric='rt'){
  const groups=new Map();
  for(const row of rows){const key=dataset==='trajectory'?`${row.targetIndex}:${row.stageNumber||3}`:String(row.targetIndex);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row)}
  const means=[...groups.values()].map(group=>group.reduce((sum,row)=>sum+Math.max(0,Number(row.firstChoiceFromOffsetMs)||0),0)/group.length);
  const slowMax=Math.max(1500,...means),points=[];
  for(const target of targets)for(const stage of dataset==='trajectory'?[1,2,3]:[3]){
    const key=dataset==='trajectory'?`${target.index}:${stage}`:String(target.index),trials=groups.get(key);
    if(!trials)continue;
    const position=dataset==='ring'||dataset==='ring8'?ringPos(target):dataset==='court'?courtPos(target):trajectoryPos(target,stage);
    const rt=trials.reduce((sum,row)=>sum+Math.max(0,Number(row.firstChoiceFromOffsetMs)||0),0)/trials.length;
    const errors=trials.filter(row=>!row.correct).length;
    points.push({...position,target,stage,count:trials.length,value:metric==='rt'?rt/slowMax:errors/trials.length,description:metric==='rt'?`${Math.round(rt)} ms`:`오답 ${errors}/${trials.length}`,id:`heat-${metric}-${points.length}`});
  }
  const heat=fieldImage(points,dataset);
  const frame=dataset==='ring'||dataset==='ring8'?ringFrame(targets):dataset==='court'?courtFrame(targets):trajectoryFrame();
  const leftLabel=metric==='rt'?'빠름':'정답',rightLabel=metric==='rt'?'느림':'오답';
  const title=metric==='rt'?'반응시간':'정확도';
  return `<svg viewBox="0 0 900 640" role="img" aria-label="${dataset==='ring'||dataset==='ring8'?'360도 방사형':dataset==='court'?'코트 위치':'투구 궤적'} ${title} 가우시안 히트맵" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="heat-scale-${metric}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#166fec"/><stop offset=".5" stop-color="#ffdb36"/><stop offset="1" stop-color="#ef3927"/></linearGradient></defs><rect width="900" height="640" fill="#0d2030"/>${frame.replace('<g data-heat-layer></g>',heat)}<rect x="635" y="17" width="244" height="43" rx="8" fill="#071925" stroke="#3a6379"/><rect x="647" y="27" width="219" height="10" rx="5" fill="url(#heat-scale-${metric})"/><text x="647" y="52" fill="#e5f0f5" font-size="12">${leftLabel}</text><text x="866" y="52" text-anchor="end" fill="#e5f0f5" font-size="12">${rightLabel}</text></svg>`;
}
