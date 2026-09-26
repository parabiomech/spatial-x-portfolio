import {ringLabel,makePlan,score,csv,mean,median} from './core.js';
import {chartSvg as graphSvg} from './charts.js';
import {heatmapSvg} from './heatmap.js?v=43';
const visualStyle=document.createElement('link');visualStyle.rel='stylesheet';visualStyle.href='./visuals.css?v=41';document.head.append(visualStyle);
const $=id=>document.getElementById(id),round=n=>Math.round(n*100)/100;
let bank,view,ctx,source,checkNodes=[],phase='setup',session,index=0,stageIndex=0,selected=null,selectedTechnique=null,firstInput=null,firstChoice=null,playInfo=null,run=0,timer,pausedFrom,libraryTarget=null;
let planSeed=globalThis.crypto?.randomUUID?.()||String(Date.now());
const cache=new Map();
const say=(text,id='trial-status')=>{$(id).textContent=text;};
function show(page){for(const id of ['setup','test','report','library'])$(id).hidden=id!==page;['step1','step2','step3'].forEach((id,i)=>$(id).classList.toggle('active',i===({setup:0,library:0,test:1,report:2}[page])));if(view&&(page==='setup'||page==='test'))view.attach($(page==='setup'?'setup-scene':'test-scene'));window.scrollTo({top:0,behavior:'instant'});}
function visualPhysics(){return{speed:Number($('throw-speed')?.value)||1,angle:Number($('throw-angle')?.value)||12,height:Number($('throw-height')?.value)||.6};}
function targets(dataset){return bank?.targets[dataset]||[];}
function targetLabel(dataset,id){return targets(dataset).find(t=>t.index===id)?.label||String(id);}
function settings(){return{version:'0.6.0',participant:$('participant').value.trim()||'anonymous',experienceYears:$('experience').value===''?null:Number($('experience').value),dataset:$('dataset').value,sound:$('sound').value,mode:$('mode').value,inputMode:$('input-mode').value,repeats:Number($('repeats').value),leadMs:3000,length:'full',seed:planSeed,visualPhysics:{speed:Number($('throw-speed').value),angle:Number($('throw-angle').value),height:Number($('throw-height').value)},gainDb:$('dataset').value==='trajectory'||$('sound').value==='pinknoise'?0:5,audioMode:'recorded stereo unchanged; pilot pink noise uses browser HRTF',responseMode:'first input, first valid selection, final confirmation; estimated scheduled audio onset/offset'};}
function update(){if(!bank)return;const set=$('dataset').value,kinds=new Set(bank.clips.filter(c=>c.dataset===set&&!c.reference).map(c=>c.kind));for(const option of $('sound').options)option.disabled=option.value==='both'?kinds.size<2:!kinds.has(option.value);if($('sound').selectedOptions[0].disabled)$('sound').value=kinds.has('impact')?'impact':([...kinds][0]||'impact');const quick=$('stimulus-shortcuts');if(quick){quick.hidden=set==='trajectory';quick.replaceChildren();for(const [v,label] of [['pinknoise','핑크노이즈'],['impact','임팩트'],['bell','방울소리'],['shake','공 흔들기'],['both','모두']]){const b=document.createElement('button'),option=[...$('sound').options].find(o=>o.value===v);b.type='button';b.textContent=label;b.disabled=!option||option.disabled;b.setAttribute('aria-pressed',String($('sound').value===v));b.onclick=()=>{$('sound').value=v;update();};quick.append(b);}}$('input-mode').options[1].disabled=set!=='ring'&&set!=='ring8';if(set!=='ring'&&set!=='ring8')$('input-mode').value='buttons';const dynamic=set==='trajectory';$('repeat-field').hidden=dynamic;$('mode').options[0].textContent=dynamic?'연습 · 4투구 × 3단계 / 단계마다 판단':'연습 · 4회 / 정답 공개';$('input-mode').closest('label').hidden=dynamic;$('task-hint').textContent=dynamic?'연습은 같은 투구를 1/3, 2/3, 3/3까지 듣고 각각 응답합니다. 평가는 차단 길이를 섞습니다.':set==='court'?'청취 위치 C0 · 상대편 9m 골대 방향': '정면 0° 기준 · 오른쪽으로 '+(set==='ring8'?45:30)+'°씩 선택';try{const c=settings(),plan=makePlan(bank.clips,c);$('count').textContent=c.dataset==='trajectory'?`${plan.length}시행 · 음원 총 길이의 1/3·2/3·전체 · 단계마다 1회 응답`:`${plan.length}회 · ${c.mode==='practice'?'짧은 연습 / 피드백 제공':'평가 / 조건별 '+c.repeats+'회 반복'} · ${c.dataset==='ring'?'12방향':c.dataset==='ring8'?'8방향 · 합성 예비 자극':c.dataset==='court'?'15지점':'3단계 시간차단'}`;$('start').disabled=!bank.ready;}catch(e){$('count').textContent=e.message;$('start').disabled=true;}view?.setDataset(set,targets(set));view?.taskView();}
function audio(){if(!ctx){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)throw Error('Web Audio를 지원하는 브라우저에서 열어 주세요.');ctx=new AC();ctx.addEventListener('statechange',()=>{if(ctx.state!=='running'&&['loading','waiting','playing','answer'].includes(phase))pause('오디오 중단으로 현재 재생을 무효화했습니다.');});}return ctx;}
function stop(){run++;clearTimeout(timer);if(source){source.onended=null;try{source.stop();}catch{}source.disconnect();source=null;}for(const n of checkNodes){try{n.disconnect();}catch{}}checkNodes=[];}
async function buffer(clip){if(cache.has(clip.id))return cache.get(clip.id);if(clip.kind==='pinknoise'){const ac=audio(),b=ac.createBuffer(1,Math.round(ac.sampleRate*1.2),ac.sampleRate),v=b.getChannelData(0);let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;for(let i=0;i<v.length;i++){const w=Math.random()*2-1;b0=.99886*b0+w*.0555179;b1=.99332*b1+w*.0750759;b2=.969*b2+w*.153852;b3=.8665*b3+w*.3104856;b4=.55*b4+w*.5329522;b5=-.7616*b5-w*.016898;v[i]=(b0+b1+b2+b3+b4+b5+b6+w*.5362)*.08;b6=w*.115926;}cache.set(clip.id,b);return b;}const res=await fetch(clip.url);if(!res.ok)throw Error('음원 파일을 불러오지 못했습니다: '+clip.id);const b=await audio().decodeAudioData(await res.arrayBuffer());if(b.numberOfChannels!==2)throw Error('현장 음원이 스테레오가 아닙니다.');if(cache.size>8)cache.delete(cache.keys().next().value);cache.set(clip.id,b);return b;}
async function channel(side){try{stop();const token=run,ac=audio();await ac.resume();if(token!==run)return;const b=ac.createBuffer(1,ac.sampleRate*.35,ac.sampleRate),v=b.getChannelData(0);for(let i=0;i<v.length;i++)v[i]=(Math.random()*2-1)*.03*Math.min(1,i/480,(v.length-i)/480);source=ac.createBufferSource();source.buffer=b;const pan=ac.createStereoPanner();pan.pan.value=side;source.connect(pan).connect(ac.destination);checkNodes=[pan];source.start();say((side<0?'왼쪽':'오른쪽')+' 확인음을 재생했습니다.','setup-status');}catch(e){say(e.message,'setup-status');}}
$('left-check').onclick=()=>channel(-1);$('right-check').onclick=()=>channel(1);
for(const id of ['dataset','sound','mode','repeats','input-mode'])$(id).onchange=update;document.querySelectorAll('.side-link[data-dataset]').forEach(b=>b.onclick=()=>{if(phase!=='setup'){say('세션을 마친 뒤 과제를 바꿔 주세요.');return;}$('dataset').value=b.dataset.dataset;update();document.querySelectorAll('.side-link').forEach(x=>x.classList.toggle('active',x===b));$('setup').scrollIntoView({behavior:'smooth'});});document.querySelector('[data-home]').onclick=()=>{if(phase!=='setup'){say('현재 세션을 마친 뒤 대시보드로 이동해 주세요.');return;}show('setup');};document.querySelector('[data-report]').onclick=()=>{if(!$('report').hidden)$('report').scrollIntoView({behavior:'smooth'});else say('테스트를 완료하면 결과 분석을 볼 수 있습니다.');};
$('start').onclick=async()=>{if(!bank?.ready)return;try{if(!$('ready-check').checked)throw Error('이어폰 좌우와 편안한 음량을 먼저 확인해 주세요.');if(!$('experience').checkValidity())throw Error('경력 입력 범위를 확인해 주세요.');stop();const ac=audio();await ac.resume();if(ac.state!=='running')throw Error('오디오를 시작할 수 없습니다. 다시 눌러 주세요.');const c=settings();session={id:new Date().toISOString(),config:c,bankVersion:bank.version,channelPair:bank.channelPair,bankReview:bank.review,plan:makePlan(bank.clips,c),rows:[],events:[],environment:{userAgent:navigator.userAgent,sampleRate:ac.sampleRate,baseLatency:ac.baseLatency??null,outputLatency:ac.outputLatency??null},startedAt:new Date().toISOString()};index=0;stageIndex=0;show('test');view?.setDataset(c.dataset,targets(c.dataset));view?.taskView();$('session-label').textContent=(c.mode==='practice'?'PRACTICE':'ASSESSMENT')+' / '+(c.dataset==='ring'?'360° · 12':c.dataset==='ring8'?'360° · 8':c.dataset==='court'?'COURT 15':'TRAJECTORY · 3 CUTS');prepare();$('cue').focus();}catch(e){say(e.message,'setup-status');}};
function current(){return bank.clips.find(c=>c.id===session.plan[index].clipId);}
function prepare(){stop();phase='ready';selected=null;selectedTechnique=null;firstInput=null;firstChoice=null;playInfo=null;view?.hideTarget();$('progress').max=session.plan.length;$('progress').value=session.rows.length;const dynamic=session.config.dataset==='trajectory',stage=session.plan[index].stage||1,cutPanel=$('cut-stages');stageIndex=stage-1;if(cutPanel){cutPanel.hidden=!dynamic;cutPanel.querySelectorAll('[data-cut-step]').forEach((b,i)=>b.setAttribute('aria-current',String(i===stageIndex)));}$('trial-count').textContent=session.config.dataset==='trajectory'?(session.config.mode==='practice'?'투구 '+String(Math.floor(index/3)+1).padStart(2,'0')+' / 04':'시행 '+String(index+1).padStart(2,'0')+' / '+session.plan.length)+' · '+stage+'/3':String(index+1).padStart(2,'0')+' / '+session.plan.length;$('cue').textContent='준비되면 소리를 들으세요.';$('cue-note').textContent=session.config.dataset==='trajectory'?`음원 시작부터 ${stage}/3까지 듣고 판단합니다.`:'고개를 정면으로 유지해 주세요.';$('play').hidden=false;$('play').disabled=false;$('play').textContent='소리 듣기';for(const id of ['response','replay','next','paused'])$(id).hidden=true;$('pause').disabled=false;say('');}
async function play(){
  if(!['ready','answer'].includes(phase))return;
  if(phase==='answer'&&session.config.mode!=='practice')return;
  if(playInfo){playInfo.valid=false;playInfo.reason='practice-replay';}
  stop();const token=run;phase='loading';$('play').disabled=true;$('play').hidden=false;$('play').textContent='음원 준비 중';
  $('response').hidden=true;$('replay').hidden=true;view?.hideTarget();say('');
  try{
    const ac=audio();await ac.resume();const clip=current(),b=await buffer(clip);
    if(token!==run)return;if(ac.state!=='running')throw Error('오디오가 중단되었습니다.');
    const c=session.config,offset=clip.onsetOffsetSeconds||0,dynamic=c.dataset==='trajectory';
    const total=dynamic?b.duration-offset:c.length==='full'?b.duration-offset:Math.min(b.duration-offset,Number(c.length)/1000);
    const start=ac.currentTime+c.leadMs/1000,onsetPerfMs=performance.now()+c.leadMs;
    playInfo={valid:true,number:session.plan[index].plays.length+1,onsetPerfMs,offsetPerfMs:null,scheduledAudioStart:start,sourceStartSeconds:clip.sourceStartSeconds,sourceOnsetSeconds:clip.onsetSeconds,playedSeconds:total,sections:[],at:new Date().toISOString()};
    session.plan[index].plays.push(playInfo);phase='waiting';$('cue').textContent='잠시 후 소리가 들립니다.';
    $('cue-note').textContent=dynamic?`음원 시작부터 ${session.plan[index].stage}/3까지 듣습니다.`:'소리가 끝나면 응답 화면이 열립니다.';
    $('play').textContent='재생 대기';
    const stage=dynamic?session.plan[index].stage:3;
    const duration=dynamic?total*stage/3:total;
    playInfo.playedSeconds=duration;playInfo.sections=[{part:stage,beginSeconds:offset,durationSeconds:duration}];
    source=ac.createBufferSource();source.buffer=b;
    if(clip.kind==='pinknoise'){
      const panner=ac.createPanner();panner.panningModel='HRTF';
      const target=targets(c.dataset).find(t=>t.index===clip.targetIndex),angle=(target?.angleClockwiseDeg??0)*Math.PI/180;
      panner.positionX.value=c.dataset==='court'?(target?.x||0)/4.2*2.4:2.4*Math.sin(angle);
      panner.positionY.value=0;panner.positionZ.value=c.dataset==='court'?-2-(target?.row||0)/9*2.4:-2.4*Math.cos(angle);
      source.connect(panner).connect(ac.destination);checkNodes=[panner];
    }else source.connect(ac.destination);
    if(dynamic){stageIndex=stage-1;$('cut-stages').querySelectorAll('[data-cut-step]').forEach((button,i)=>button.setAttribute('aria-current',String(i===stage-1)));$('cue-note').textContent=stage+'/3까지 재생 중';}
    source.onended=()=>{if(token!==run)return;source?.disconnect();source=null;playInfo.offsetPerfMs=performance.now();phase='answer';$('play').hidden=true;$('cue').textContent=dynamic?'공이 어느 구역으로 향했나요?':'어디에서 들렸나요?';$('cue-note').textContent='선택한 뒤 응답을 확정하세요.';renderAnswers();$('response').hidden=false;$('replay').hidden=c.mode!=='practice';$('cue').focus();say('소리가 끝났습니다. 응답을 선택해 주세요.');};
    source.start(start,offset,duration);
    if(c.mode==='practice'&&dynamic)setTimeout(()=>{if(token===run)view?.reveal(clip.targetIndex,'trajectory',clip.technique,duration,c.visualPhysics);},c.leadMs);
    timer=setTimeout(()=>{if(token!==run)return;phase='playing';$('play').textContent='재생 중';},c.leadMs);
  }catch(e){if(token!==run)return;stop();phase='ready';$('play').disabled=false;$('play').textContent='다시 듣기';say(e.message);}
}
$('play').onclick=play;$('replay').onclick=play;
function renderAnswers(){selected=null;selectedTechnique=null;firstInput=null;firstChoice=null;$('selection').textContent='';$('confirm').disabled=true;const tech=$('technique-answers');tech.hidden=session.config.dataset!=='trajectory';tech.replaceChildren();if(session.config.dataset==='trajectory'){const label=document.createElement('p');label.className='technique-prompt';label.textContent='투구 유형';tech.append(label);for(const type of ['F','2B','3B']){const b=document.createElement('button');b.type='button';b.textContent=type;b.setAttribute('aria-pressed','false');b.onclick=()=>{if(phase!=='answer')return;selectedTechnique=type;if(firstInput===null)firstInput=performance.now();if(firstChoice===null)firstChoice=performance.now();tech.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));$('selection').textContent='투구 '+type+(selected===null?'':' · 코스 '+targetLabel('trajectory',selected));$('confirm').disabled=selected===null;};tech.append(b);}}const map=$('answers');map.replaceChildren();const radial=session.config.dataset==='ring'||session.config.dataset==='ring8';map.className='choice-grid '+((session.config.dataset==='ring'||session.config.dataset==='ring8')?'ring':session.config.dataset==='trajectory'?'trajectory':'court');if(radial){const center=document.createElement('span');center.className='ring-center';center.textContent='청취자';map.append(center);}map.closest('fieldset').querySelector('legend').textContent=(session.config.dataset==='ring'||session.config.dataset==='ring8')?'들린 방향을 선택하세요.':session.config.dataset==='trajectory'?'수비 코스를 선택하세요.':'코트 위치를 선택하세요.';for(const t of (session.config.dataset==='court'?[...targets('court')].sort((a,b)=>b.row-a.row||a.x-b.x):session.config.dataset==='trajectory'?[...targets('trajectory')].sort((a,b)=>[1,0,2,4,3].indexOf(a.index)-[1,0,2,4,3].indexOf(b.index)):targets(session.config.dataset))){const b=document.createElement('button');b.type='button';b.textContent=(session.config.dataset==='ring'||session.config.dataset==='ring8')?t.index*(session.config.dataset==='ring8'?45:30)+'°':t.label;b.setAttribute('aria-label',t.label);if(radial){const angle=t.index*Math.PI/(session.config.dataset==='ring8'?4:6);b.style.left=(50+Math.sin(angle)*40)+'%';b.style.top=(50-Math.cos(angle)*40)+'%';}if(session.config.dataset==='trajectory'){const subtitle=document.createElement('small');subtitle.textContent={FL:'Far Left',NL:'Near Left',C:'Center',NR:'Near Right',FR:'Far Right'}[t.label];b.append(subtitle);}b.dataset.answer=t.index;b.setAttribute('aria-pressed','false');b.onpointerdown=()=>{if(phase==='answer'&&firstInput===null)firstInput=performance.now()};b.onclick=()=>choose(t.index);map.append(b)}configureResponseDrag(map);}
function configureResponseDrag(map){
  const enabled=session.config.inputMode==='drag'&&(session.config.dataset==='ring'||session.config.dataset==='ring8');
  map.classList.toggle('drag-enabled',enabled);
  map.onpointerdown=map.onpointermove=map.onpointerup=map.onpointercancel=null;
  if(!enabled)return;
  let gesture=null;
  const pick=e=>{
    let best=null,distance=Infinity;
    for(const button of map.querySelectorAll('[data-answer]')){
      const box=button.getBoundingClientRect(),d=Math.hypot(e.clientX-(box.left+box.width/2),e.clientY-(box.top+box.height/2));
      if(d<distance){distance=d;best=button;}
    }
    if(best)choose(Number(best.dataset.answer));
  };
  map.onpointerdown=e=>{if(phase!=='answer')return;gesture={id:e.pointerId,x:e.clientX,y:e.clientY};if(firstInput===null)firstInput=performance.now();map.setPointerCapture(e.pointerId);};
  map.onpointermove=e=>{if(!gesture||gesture.id!==e.pointerId||phase!=='answer')return;if(Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y)>10)pick(e);};
  map.onpointerup=e=>{if(gesture?.id===e.pointerId){if(Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y)>10)pick(e);gesture=null;}};
  map.onpointercancel=()=>{gesture=null;};
}
function choose(value){if(phase!=='answer')return;if(firstInput===null)firstInput=performance.now();if(firstChoice===null)firstChoice=performance.now();selected=value;document.querySelectorAll('[data-answer]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.answer)===value)));$('selection').textContent=session.config.dataset==='trajectory'?'투구 '+(selectedTechnique||'—')+' · 코스 '+targetLabel(session.config.dataset,value):'선택: '+targetLabel(session.config.dataset,value);$('confirm').disabled=session.config.dataset==='trajectory'&&selectedTechnique===null;}
$('confirm').onclick=()=>{if(phase!=='answer'||selected===null||(session.config.dataset==='trajectory'&&selectedTechnique===null))return;const now=performance.now(),clip=current(),c=session.config;const row={sessionId:session.id,participant:c.participant,dataset:c.dataset,mode:c.mode,inputMode:c.inputMode,trial:session.rows.length+1,throwNumber:index+1,stageNumber:c.dataset==='trajectory'?session.plan[index].stage:null,repeat:session.plan[index].repeat,clipId:clip.id,kind:clip.kind,technique:clip.technique||null,cutPercent:c.dataset==='trajectory'?session.plan[index].stage*100/3:null,cutMs:null,cutLabel:c.dataset==='trajectory'?session.plan[index].stage+'/3':null,targetIndex:clip.targetIndex,targetLabel:clip.label,responseIndex:selected,responseLabel:targetLabel(c.dataset,selected),...score(clip,selected),techniqueResponse:selectedTechnique,techniqueCorrect:c.dataset==='trajectory'?selectedTechnique===clip.technique:null,firstInputFromOnsetMs:round(firstInput-playInfo.onsetPerfMs),firstChoiceFromOnsetMs:round(firstChoice-playInfo.onsetPerfMs),firstChoiceFromOffsetMs:round(firstChoice-playInfo.offsetPerfMs),confirmFromOnsetMs:round(now-playInfo.onsetPerfMs),confirmFromOffsetMs:round(now-playInfo.offsetPerfMs),playedSeconds:round(playInfo.playedSeconds),gainDb:c.gainDb,channelPair:bank.channelPair.join('/'),sourceOnsetSeconds:clip.onsetSeconds,pilotSynth:!!clip.pilotSynth,mixSourceIds:clip.mixSourceIds?.join('|')||null,playCount:session.plan[index].plays.length,at:new Date().toISOString()};if(c.dataset==='trajectory')row.correct=row.correct&&row.techniqueCorrect;session.rows.push(row);phase='feedback';$('response').hidden=true;$('replay').hidden=true;$('next').hidden=false;$('next').textContent=index+1===session.plan.length?'결과 보기':c.dataset==='trajectory'&&c.mode==='practice'?(session.plan[index].stage<3?'다음 구간':'다음 투구'):'다음 시행';$('progress').value=session.rows.length;if(c.mode==='practice'){$('cue').textContent=row.correct?'정답입니다.':'다른 위치를 선택했습니다.';$('cue-note').textContent='정답: '+clip.label+(clip.kind==='trajectory'?' · '+clip.technique:' · '+(clip.kind==='impact'?'임팩트':clip.kind==='pinknoise'?'핑크노이즈':'흔들기'))+' / 공 움직임은 설명용 재현입니다.';view?.reveal(clip.targetIndex,clip.kind,clip.technique,clip.durationSeconds,session?.config.visualPhysics||visualPhysics());}else{$('cue').textContent='응답을 기록했습니다.';$('cue-note').textContent='준비되면 다음 시행을 시작하세요.';}$('next').focus();};
$('next').onclick=()=>{if(phase!=='feedback')return;advance();if(index===session.plan.length)finish(false);else{prepare();$('play').focus();}};
function advance(){index++;stageIndex=0;}
function pause(reason='일시정지했습니다.'){if(!session||!['ready','loading','waiting','playing','answer','feedback'].includes(phase))return;pausedFrom=phase;if(playInfo&&phase!=='feedback'){playInfo.valid=false;playInfo.reason=reason;}session.events.push({type:'pause',trial:index+1,reason,phase,at:new Date().toISOString()});stop();phase='paused';for(const id of ['play','response','replay','next'])$(id).hidden=true;$('pause').disabled=true;$('paused').hidden=false;$('cue').textContent='잠시 쉬어 가세요.';$('cue-note').textContent='미완료 시행은 같은 음원으로 다시 준비합니다.';say(reason);}
$('pause').onclick=()=>pause();$('resume').onclick=()=>{if(phase!=='paused')return;if(pausedFrom==='feedback')advance();if(index===session.plan.length)finish(false);else{prepare();$('play').focus();}};$('finish').onclick=()=>finish(true);
document.addEventListener('visibilitychange',()=>{if(document.hidden){pause('화면을 벗어나 현재 재생을 무효화했습니다.');document.querySelectorAll('audio').forEach(a=>a.pause());}});window.addEventListener('pagehide',stop);window.addEventListener('beforeunload',e=>{if(session?.rows.length&&!session.exported){e.preventDefault();e.returnValue='';}});
$('fullscreen').onclick=()=>{const box=document.querySelector('.scene-panel');if(document.fullscreenElement)document.exitFullscreen();else box?.requestFullscreen?.();};$('immersive').onclick=()=>{document.body.classList.toggle('immersive-mode');view?.resize();};
function chartSvg(rows,key){return graphSvg(rows,key,session.config.dataset);}
function paintResults(rows){
  $('accuracy-chart').previousElementSibling.textContent='시행별 정답률';
  $('accuracy-chart').innerHTML=chartSvg(rows,'correct');$('rt-chart').innerHTML=chartSvg(rows,'rt');
  const render=metric=>{
    $('heatmap').innerHTML=heatmapSvg(rows,session.config.dataset,targets(session.config.dataset),metric);
    $('heatmap').setAttribute('aria-label',(metric==='rt'?'반응시간':'오답률')+' 위치 도식 히트맵');
    document.querySelectorAll('[data-heatmap-metric]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.heatmapMetric===metric)));
  };
  document.querySelectorAll('[data-heatmap-metric]').forEach(button=>button.onclick=()=>render(button.dataset.heatmapMetric));
  render('rt');
}
function finish(early){
  stop();if(document.fullscreenElement)document.exitFullscreen();document.body.classList.remove('immersive-mode');
  phase='report';session.endedAt=new Date().toISOString();session.early=early;
  show('report');$('step3').classList.add('active');
  const rows=session.rows,c=session.config,total=session.plan.length;
  $('report-title').textContent=c.dataset==='trajectory'?'공의 코스를 맞혔나요?':'어떤 방향이 잘 들렸나요?';
  const task=c.dataset==='ring'?'360° · 12방향':c.dataset==='ring8'?'360° · 8방향 (합성 예비)':c.dataset==='court'?'코트 위치':'공 궤적 · 3단계 차단';
  $('report-summary').textContent=`${c.participant} · ${task} · ${c.mode==='practice'?'연습':'평가'} · ${rows.length}/${total}회${early?' · 중도 종료':''}`;
  const values=[['평균 반응시간',rows.length?Math.round(mean(rows.map(r=>r.firstChoiceFromOffsetMs)))+' ms':'—'],['정답률',rows.length?round(mean(rows.map(r=>+r.correct))*100)+'%':'—'],['시도 수',rows.length+'회']];
  $('metrics').replaceChildren();for(const [label,value]of values){const d=document.createElement('div');d.className='metric';d.innerHTML=`<strong>${value}</strong><span>${label}</span>`;$('metrics').append(d);}
  paintResults(rows);
  const table=document.createElement('table'),head=document.createElement('thead'),hr=document.createElement('tr');
  const columns=c.dataset==='trajectory'?['시행','차단','투구 유형','정답 코스','응답 유형 · 코스','정답','반응시간']:['시행','자극 위치','소리','응답 위치','정답','반응시간'];
  for(const label of columns){const th=document.createElement('th');th.scope='col';th.textContent=label;hr.append(th);}head.append(hr);table.append(head);
  const body=document.createElement('tbody');for(const r of rows){const tr=document.createElement('tr');
    const values=[r.trial,...(c.dataset==='trajectory'?[r.stageNumber+'/3']:[]),c.dataset==='trajectory'?r.technique:r.targetLabel,c.dataset==='trajectory'?r.targetLabel:r.kind==='impact'?'임팩트':r.kind==='pinknoise'?'핑크노이즈':'흔들기',c.dataset==='trajectory'?(r.techniqueResponse||'—')+' · '+r.responseLabel:r.responseLabel,r.correct?'정답':'오답',Math.round(r.firstChoiceFromOffsetMs)+' ms'];
    for(const value of values){const td=document.createElement('td');td.textContent=value;tr.append(td);}body.append(tr);
  }table.append(body);$('table').replaceChildren(table);
  $('timing-note').textContent='반응시간은 음원 종료부터 첫 선택까지의 브라우저 추정치입니다. 투구 음원은 전체 길이를 기준으로 1/3·2/3·전체까지 누적 제시합니다. 연습은 단계마다 응답하고 평가는 단계 순서를 섞습니다. 8방향 임팩트·흔들기와 핑크노이즈는 합성 예비 자극입니다. 출력 지연은 교정되지 않았습니다.';
  $('report-title').focus();
}
function save(content,type,ext){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download='spatial-x-'+session.id.replace(/[:.]/g,'-')+'.'+ext;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);session.exported=true;say('저장을 요청했습니다. 파일이 내려받아졌는지 확인하세요.','save-status');}
$('csv').onclick=()=>save(csv(session.rows),'text/csv;charset=utf-8','csv');$('json').onclick=()=>save(JSON.stringify({...session,stimuli:bank.clips.filter(c=>session.plan.some(p=>p.clipId===c.id))},null,2),'application/json','json');$('print').onclick=()=>window.print();$('restart').onclick=()=>{planSeed=globalThis.crypto?.randomUUID?.()||String(Date.now());phase='setup';show('setup');update();say('새 세션을 시작하면 이전 결과가 교체됩니다. 필요한 파일을 먼저 저장하세요.','setup-status');};
$('close-library').onclick=()=>{document.querySelectorAll('audio').forEach(a=>a.pause());phase='setup';show('setup');update();};
$('view-listener').onclick=()=>view?.taskView();$('view-scan').textContent='실제 경기장 SOG 보기';$('view-scan').onclick=async()=>{const b=$('view-scan'),show=b.getAttribute('aria-pressed')!=='true';b.disabled=true;try{if(show)$('scene-status').textContent='기존 playground의 실제 경기장 스캔을 불러오고 있습니다…';const count=await view?.toggleScan(show);b.setAttribute('aria-pressed',String(show));$('scene-status').textContent=show?'기존 playground의 splat_2949001.sog · 동일한 배치값을 사용한 시각적 공간 참조입니다. 녹음 위치 정합은 검수 전입니다.':'경기장 배치 + Unity 공 모델 · 카메라와 청취 방향은 독립적입니다.';}catch(e){$('scene-status').textContent='실제 스캔을 불러오지 못했습니다. 기본 경기장으로 계속 사용할 수 있습니다.';}finally{b.disabled=false;}};
 try{const r=await fetch('./assets/audio-manifest.json?v=42');if(!r.ok)throw Error('음원 추출 목록이 아직 준비되지 않았습니다.');bank=await r.json();$('library-note').textContent='현장 녹음 추출본입니다. 음원별 구간을 듣고 확인하세요.';update();renderFamiliar();say(bank.ready?'음원 준비 완료 · 낮은 기기 음량에서 시작하세요.':'음원 채널 확인 후 활성화됩니다.','setup-status');}catch(e){say(e.message,'setup-status');}
try{const {CourtView}=await import('./scene.js?v=44');view=new CourtView($('setup-scene'));if(bank)view.setDataset($('dataset').value,targets($('dataset').value));$('scene-status').textContent='경기장 공간 · 소리 위치는 공으로 표시';}catch(e){$('scene-status').textContent='이 기기에서 3D 화면을 열지 못했습니다. 음원과 버튼 테스트는 계속 사용할 수 있습니다.';}
if(document.modelContext?.registerTool){try{Promise.resolve(document.modelContext.registerTool({name:'read_static_test_status',description:'Read static test phase and counts without revealing stimulus answers or participant information.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute(input){if(!input||Object.keys(input).length)throw Error('No parameters expected.');return{phase,dataset:session?.config.dataset||$('dataset').value,completed:session?.rows.length||0,total:session?.plan.length||0,audioReady:!!bank?.ready,sceneReady:!!view};}})).catch(()=>{});}catch{}}

async function previewClip(clip){
  if(!clip)return;
  stop();document.querySelectorAll('audio').forEach(a=>a.pause());const token=run;
  try{
    const ac=audio();await ac.resume();const b=await buffer(clip);if(token!==run)return;
    source=ac.createBufferSource();source.buffer=b;
    if(clip.kind==='pinknoise'){
      const panner=ac.createPanner();panner.panningModel='HRTF';
      const target=targets(clip.dataset).find(t=>t.index===clip.targetIndex);
      const angle=(target?.angleClockwiseDeg??0)*Math.PI/180;
      panner.positionX.value=clip.dataset==='court'?(target?.x||0)/4.2*2.4:2.4*Math.sin(angle);
      panner.positionY.value=0;
      panner.positionZ.value=clip.dataset==='court'?-2-(target?.row||0)/9*2.4:-2.4*Math.cos(angle);
      source.connect(panner).connect(ac.destination);checkNodes=[panner];
    }else source.connect(ac.destination);
    view?.setDataset(clip.dataset,targets(clip.dataset));view?.reveal(clip.targetIndex,clip.kind,clip.technique,clip.durationSeconds,visualPhysics());
    source.onended=()=>{if(token!==run)return;source?.disconnect();source=null;};
    source.start();
    return true;
  }catch(e){say(e.message,'setup-status');return false;}
}
// Review from a spatial map, then audition the matching field recording.
function mapLibrary(){
 if(!bank)return;document.querySelectorAll('audio').forEach(a=>a.pause());
 const set=$('library-set').value,kind=$('library-kind').value;
 if(mapLibrary.lastSet!==set){libraryTarget=null;mapLibrary.lastSet=set;}
 const spatialSet=set==='reference'?'ring':set;
 let root=$('library-map');if(!root){root=document.createElement('section');root.id='library-map';root.className='library-map';$('clips').before(root)}
 root.replaceChildren();const title=document.createElement('h2');title.textContent='위치';root.append(title);
 const filters=document.createElement('div');filters.className='library-positions';
 const all=document.createElement('button');all.type='button';all.textContent='전체';all.setAttribute('aria-pressed',String(libraryTarget===null));all.onclick=()=>{libraryTarget=null;mapLibrary()};filters.append(all);
 for(const t of targets(spatialSet)){const b=document.createElement('button');b.type='button';b.textContent=set==='ring'||set==='ring8'?t.index*(set==='ring8'?45:30)+'°':t.label;b.setAttribute('aria-label',t.label);b.setAttribute('aria-pressed',String(libraryTarget===t.index));b.onclick=()=>{libraryTarget=t.index;mapLibrary()};filters.append(b)}root.append(filters);
  $('clips').replaceChildren();for(const clip of bank.clips.filter(c=>(set==='reference'?c.reference:c.dataset===set&&!c.reference)&&(kind==='all'||c.kind===kind)&&(libraryTarget===null||c.targetIndex===libraryTarget))){const card=document.createElement('article');card.className='clip';const h=document.createElement('h3');h.textContent=clip.label+' · '+(clip.kind==='trajectory'?'궤적 · '+clip.technique:clip.kind==='impact'?'임팩트':clip.kind==='pinknoise'?'핑크노이즈':'흔들기');const small=document.createElement('small');small.textContent=clip.pilotSynth?'합성 예비 자극 · '+clip.id:clip.id+` / 원본 ${clip.sourceStartSeconds.toFixed(3)}–${clip.sourceEndSeconds.toFixed(3)}초`;card.append(h,small);if(clip.url){const player=document.createElement('audio');player.controls=true;player.preload='none';player.src=clip.url;player.setAttribute('aria-label',h.textContent);player.onplay=()=>{stop();document.querySelectorAll('audio').forEach(a=>{if(a!==player)a.pause()});};card.append(player);const link=document.createElement('a');link.href=clip.url;link.download=clip.url.split('/').pop();link.textContent='WAV 다운로드';card.append(link);}else{const button=document.createElement('button');button.textContent='합성 음원 듣기';button.onclick=()=>previewClip(clip);card.append(button);} $('clips').append(card)}
}
$('open-library').onclick=()=>{stop();phase='library';show('library');mapLibrary()};$('library-set').onchange=mapLibrary;$('library-kind').onchange=mapLibrary;
// Mark the sounding location in the scan as the scheduled playback begins.
const runPlay=play;
$('play').onclick=()=>{const c=current(),lead=session?.config.leadMs||0;const done=runPlay();const turn=run;if(session?.config.mode==='practice'&&session?.config.dataset!=='trajectory')setTimeout(()=>{if(turn===run&&['waiting','playing','answer'].includes(phase))view?.reveal(c.targetIndex,c.kind,c.technique,c.durationSeconds,visualPhysics())},lead);return done};
$('view-listener').textContent='과제 기본 시점';$('view-scan').textContent='SOG 공간 표시 전환';$('view-scan').setAttribute('aria-pressed','true');
const testSceneNote=document.querySelector('.test-layout .scan-note');if(testSceneNote)testSceneNote.textContent='경기장 SOG · 공은 재생 위치를 표시합니다.';

// Keep the response and playback controls inside the same surface as the court.
const testStage=$('test-scene');
const stageTools=document.querySelector('.immersive-tools');
// The setup view also keeps its camera controls on the court image.
$('setup-scene').append(document.querySelector('.view-controls'));
testStage.append(stageTools,$('progress'),document.querySelector('.response-panel'));
stageTools.append($('pause'));
$('fullscreen').onclick=()=>document.fullscreenElement?document.exitFullscreen():testStage.requestFullscreen?.();
$('immersive').onclick=()=>{document.body.classList.toggle('immersive-mode');view?.resize();};

// Keep audio review as filters and players; the court view belongs to the test.


const setupGrid=document.querySelector('#setup .grid');
const methodDetails=document.querySelector('#setup details.card');
if(setupGrid&&methodDetails)setupGrid.append(methodDetails);

const familiarCounts=new Map();
const familiarCard=document.createElement('section');familiarCard.className='card familiar-card';familiarCard.id='familiar';
familiarCard.innerHTML='<h2>소리 적응</h2><p class="muted">위치를 누르면 해당 소리가 재생됩니다. 위치별 최대 3회.</p><div class="familiar-controls"><label>과제<select id="familiar-set"><option value="ring">360° · 12방향</option><option value="ring8">360° · 8방향</option><option value="court">코트 · 15위치</option><option value="trajectory">공 궤적 · 5코스</option></select></label><label>소리<select id="familiar-kind"></select></label></div><div id="familiar-positions" class="familiar-positions"></div><p id="familiar-status" class="status" role="status"></p>';
setupGrid?.insertBefore(familiarCard,setupGrid.querySelector(':scope > .card'));
function renderFamiliar(){
  if(!bank||!$('familiar-set'))return;
  const set=$('familiar-set').value,kindSelect=$('familiar-kind'),previous=kindSelect.value;
  const types=set==='trajectory'?[['F','F · 플랫'],['2B','2B · 2바운드'],['3B','3B · 3바운드']]:[['impact','임팩트'],['shake','공 흔들기'],['pinknoise','핑크노이즈 · 합성']];
  kindSelect.replaceChildren();for(const [value,label] of types){if(set!=='trajectory'&&!bank.clips.some(c=>c.dataset===set&&c.kind===value))continue;const option=document.createElement('option');option.value=value;option.textContent=label;kindSelect.append(option);}
  if([...kindSelect.options].some(o=>o.value===previous))kindSelect.value=previous;
  const root=$('familiar-positions');root.replaceChildren();root.className='familiar-positions '+set;
  for(const target of (set==='trajectory'?[...targets(set)].sort((a,b)=>[1,0,2,4,3].indexOf(a.index)-[1,0,2,4,3].indexOf(b.index)):targets(set))){
    const key=set+':'+target.index,used=familiarCounts.get(key)||0;
    const button=document.createElement('button');button.type='button';button.disabled=used>=3;
    button.textContent=(set==='trajectory'?target.label+' · '+({FL:'Far Left',NL:'Near Left',C:'Center',NR:'Near Right',FR:'Far Right'}[target.label]):target.label)+' · '+(3-used)+'/3';button.setAttribute('aria-label',target.label+' · 남은 청취 '+(3-used)+'회');
    button.onclick=async()=>{
      const selectedKind=kindSelect.value;
      const clip=bank.clips.find(c=>c.dataset===set&&c.targetIndex===target.index&&!c.reference&&(set==='trajectory'?c.technique===selectedKind:c.kind===selectedKind));
      if(!clip){$('familiar-status').textContent='이 위치의 음원이 아직 없습니다.';return;}
      button.disabled=true;
      const played=await previewClip(clip);
      if(played){familiarCounts.set(key,(familiarCounts.get(key)||0)+1);$('familiar-status').textContent=target.label+' · '+(familiarCounts.get(key))+'/3회 청취';}
      renderFamiliar();
    };
    root.append(button);
  }
}
$('familiar-set').onchange=()=>{renderFamiliar();const set=$('familiar-set').value;view?.setDataset(set,targets(set));view?.taskView();};
$('familiar-kind').onchange=renderFamiliar;for(const [input,output,unit] of [['throw-speed','speed-value','×'],['throw-angle','angle-value','°'],['throw-height','height-value','m']])$(input).oninput=()=>{$(output).textContent=$(input).value+unit;};
renderFamiliar();

if(location.protocol==='file:'){
  const notice=document.createElement('p');notice.className='local-notice';
  notice.innerHTML='실제 경기장과 음원을 불러오려면 <a href="https://parabiomech.github.io/spatial-x-portfolio/testbed/">웹 테스트베드 주소</a>로 열어 주세요.';
  $('setup').prepend(notice);
}



















