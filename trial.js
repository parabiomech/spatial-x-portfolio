(() => {
'use strict';
const $=id=>document.getElementById(id), samples=window.throwSamples;
const start=$('trial-start'), left=$('trial-left'), right=$('trial-right'), stop=$('trial-stop');
const canvas=$('trial-wave'), g=canvas.getContext('2d'), mask=$('trial-mask');
let ctx, source, run=0, state='idle', stage=0, direction, buffer, begin=0, finish=0, clockStart=0, elapsed=0, cut=0, answerAt=0, frame=0, rows=[];
const decoded={}; const names={left:'왼쪽',right:'오른쪽'};
const commonPeak=Math.max(...Object.values(samples).flatMap(s=>s.peaks.flatMap(p=>p.map(Math.abs))),.01);
function lockSettings(locked){document.querySelectorAll('.trial-setup input').forEach(i=>i.disabled=locked);}
function message(text){$('trial-status').textContent=text;}
function cover(title,note){mask.hidden=false;$('trial-mask-title').textContent=title;$('trial-mask-note').textContent=note;}
function halt(){cancelAnimationFrame(frame);if(source){source.onended=null;try{source.stop();}catch{}source.disconnect();source=null;}}
function draw(){
 const w=canvas.width,h=canvas.height,x0=35,x1=w-25,top=20,bottom=h-35,mid=(top+bottom)/2;
 g.clearRect(0,0,w,h);g.fillStyle='#071322';g.fillRect(0,0,w,h);
 for(let n=0;n<3;n++){g.fillStyle=['#112942','#132d46','#16324d'][n];g.fillRect(x0+(x1-x0)*n/3,top,(x1-x0)/3,bottom-top);}
 g.strokeStyle='#436079';g.lineWidth=1;g.beginPath();g.moveTo(x0,mid);g.lineTo(x1,mid);g.stroke();
 const duration=finish-begin;let fraction=duration>0?Math.min(elapsed/duration,1):0;
 if(direction&&duration>0){const sample=samples[direction];g.strokeStyle='#99d4ff';g.lineWidth=1.1;g.beginPath();
 for(let i=0;i<sample.peaks.length;i++){const t=i/sample.peaks.length*sample.duration;if(t<begin||t>begin+elapsed||t>finish)continue;const x=x0+(t-begin)/duration*(x1-x0);const p=sample.peaks[i];g.moveTo(x,mid-p[1]/commonPeak*(bottom-top)*.44);g.lineTo(x,mid-p[0]/commonPeak*(bottom-top)*.44);}g.stroke();}
 g.fillStyle='#030b15b0';g.fillRect(x0+(x1-x0)*fraction,top,(x1-x0)*(1-fraction),bottom-top);
 for(let n=1;n<=3;n++){const x=x0+(x1-x0)*n/3;g.setLineDash([4,6]);g.strokeStyle='#6689aa';g.beginPath();g.moveTo(x,top);g.lineTo(x,bottom);g.stroke();g.setLineDash([]);g.fillStyle='#a7c4df';g.font='12px Arial';g.textAlign='right';g.fillText(duration>0?(duration*n/3).toFixed(2)+' s':['⅓','⅔','3/3'][n-1],x-4,h-12);}
 if(direction){const x=x0+(x1-x0)*fraction;g.strokeStyle='#def3ff';g.lineWidth=2;g.beginPath();g.moveTo(x,top);g.lineTo(x,bottom);g.stroke();}
}
async function loadAudio(side){if(decoded[side])return decoded[side];const data=Uint8Array.from(atob(samples[side].base64),c=>c.charCodeAt(0));decoded[side]=await ctx.decodeAudioData(data.buffer);return decoded[side];}
function animate(token){if(token!==run||state!=='playing')return;elapsed=Math.min(Math.max(ctx.currentTime-clockStart,0),cut);draw();frame=requestAnimationFrame(()=>animate(token));}
function occlude(token){if(token!==run||state!=='playing')return;source=null;cancelAnimationFrame(frame);elapsed=cut;draw();state='answer';cover('차단되었습니다','어느 방향으로 투구했나요?');answerAt=performance.now();left.disabled=right.disabled=false;message(`${stage+1}구간 차단 · 왼쪽 또는 오른쪽을 선택하세요.`);left.focus();}
async function play(){
 const token=++run;state='loading';start.disabled=true;left.disabled=right.disabled=true;stop.disabled=false;lockSettings(true);
 try{
 if(!ctx)ctx=new (window.AudioContext||window.webkitAudioContext)();await ctx.resume();if(token!==run)return;
 buffer=await loadAudio(direction);if(token!==run)return;
 cut=(finish-begin)*(stage+1)/3;elapsed=0;draw();
 document.querySelectorAll('audio,video').forEach(m=>m.pause());
 source=ctx.createBufferSource();source.buffer=buffer;source.connect(ctx.destination);source.onended=()=>occlude(token);clockStart=ctx.currentTime+.07;state='playing';mask.hidden=true;
 $('trial-stage').textContent=`${stage+1} / 3 · ${['⅓','⅔','도착 직전'][stage]}`;
 message(`투구 시작부터 ${cut.toFixed(2)}초까지 재생합니다. 차단 후 응답해 주세요.`);
 source.start(clockStart,begin,cut);animate(token);
 }catch(error){if(token!==run)return;abort('음원을 재생하지 못했습니다. 브라우저의 소리 권한을 확인한 뒤 다시 시작해 주세요.');}
}
function abort(text='중단되었습니다. 새 테스트를 시작할 수 있습니다.'){
 ++run;halt();state='idle';elapsed=0;direction=null;rows=[];draw();start.disabled=false;start.textContent='테스트 시작';left.disabled=right.disabled=stop.disabled=true;lockSettings(false);cover('테스트 준비',text);message(text);$('trial-stage').textContent='READY';
}
function beginTrial(){
 if(state==='next'){play();return;}
 let settings={};for(const side of ['left','right']){const a=Number($('start-'+side).value),b=Number($('end-'+side).value);if(!Number.isFinite(a)||!Number.isFinite(b)||a<0||b<=a+.15||b>samples[side].duration+.002){message(`${names[side]} 시작·도착 시점을 확인하세요. 0초부터 ${samples[side].duration.toFixed(3)}초 사이, 최소 0.15초 이상이어야 합니다.`);return;}settings[side]=[a,Math.min(b,samples[side].duration)];}
 direction=Math.random()<.5?'left':'right';[begin,finish]=settings[direction];stage=0;rows=[];$('trial-results').hidden=true;play();
}
function answer(choice){if(state!=='answer')return;rows.push({choice,correct:choice===direction,seconds:(performance.now()-answerAt)/1000,cut});left.disabled=right.disabled=true;
 if(stage<2){stage++;state='next';start.disabled=false;start.textContent=`${stage+1}구간 재생`;cover('응답을 기록했습니다','다음 구간은 투구 시작부터 더 길게 재생됩니다.');message('정답은 세 구간 응답 후 공개됩니다. 다음 구간을 재생해 주세요.');start.focus();}
 else{
 state='complete';stop.disabled=true;start.disabled=false;start.textContent='새 투구로 다시 시작';lockSettings(false);$('trial-results').hidden=false;
 $('trial-rows').replaceChildren(...rows.map((r,i)=>{const tr=document.createElement('tr');for(const text of [`${i+1}구간 · ${r.cut.toFixed(2)}초`,names[r.choice],r.correct?'O · 정답':'X · 오답',r.seconds.toFixed(2)+'초']){const td=document.createElement('td');td.textContent=text;tr.append(td);}tr.children[2].className=r.correct?'result-correct':'result-wrong';return tr;}));
 const first=rows.findIndex(r=>r.correct);$('trial-summary').textContent=`정답: ${names[direction]} 투구 · ${rows.filter(r=>r.correct).length}/3 정답. `+(first<0?'이번 투구에서는 맞힌 구간이 없습니다.':`처음 맞힌 시점: ${first+1}구간 (${rows[first].cut.toFixed(2)}초 청취 후).`);
 cover('세 구간 완료',rows.map(r=>r.correct?'O':'X').join('  /  '));message('아래에서 구간별 O/X와 응답시간을 확인하세요.');$('trial-stage').textContent='RESULT';
 }
}
start.addEventListener('click',beginTrial);left.addEventListener('click',()=>answer('left'));right.addEventListener('click',()=>answer('right'));stop.addEventListener('click',()=>abort());
document.addEventListener('visibilitychange',()=>{if(document.hidden&&['loading','playing','answer','next'].includes(state))abort('화면을 벗어나 테스트가 중단되었습니다.');});
draw();
})();
