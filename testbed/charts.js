import {mean} from './core.js';

export function chartSvg(rows,key,dataset='ring'){
 const temporal=key==='correct'&&dataset==='trajectory',cuts=[200,400,600,800,null];
 const vals=temporal?cuts.map(c=>{const group=rows.filter(r=>r.cutMs===c);return group.length?mean(group.map(r=>+r.correct)):0}):rows.map(r=>key==='correct'?+r.correct:Number(r.firstChoiceFromOffsetMs));
 const W=720,H=210,L=44,R=12,T=14,B=32,max=key==='correct'?1:Math.max(1000,Math.ceil(Math.max(...vals,0)/1000)*1000),min=0;
 const pts=vals.map((v,i)=>[L+i*(W-L-R)/Math.max(1,vals.length-1),T+(H-T-B)*(1-v/max)]);let grid='';
 for(let i=0;i<=4;i++){const y=T+i*(H-T-B)/4;grid+=`<path d="M${L} ${y}H${W-R}" stroke="#40516a"/><text x="${L-8}" y="${y+4}" text-anchor="end" fill="#a6b8d0" font-size="11">${key==='correct'?Math.round(100-i*25)+'%':Math.round(max*(1-i/4))+' ms'}</text>`;}
 const dots=pts.map((p,i)=>{const label=temporal?`${cuts[i]===null?'Full':cuts[i]+' ms'}`: `시행 ${i+1}`;return`<circle cx="${p[0]}" cy="${p[1]}" r="${temporal?6:4}" fill="${key==='correct'?(vals[i]>.5?'#72e3bf':'#ed7666'):'#ffbd72'}"><title>${label}: ${key==='correct'?Math.round(vals[i]*100)+'%':Math.round(vals[i])+' ms'}</title></circle>`}).join('');
 const xlabel=temporal?'시간차단 구간 →':'자극 제시 순서 →',aria=temporal?'시간차단 비율별 정답률 그래프':key==='correct'?'시행순 정답률 그래프':'시행순 반응시간 그래프';
 return`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${aria}">${grid}<polyline fill="none" stroke="${key==='correct'?'#76e2de':'#ffbd72'}" stroke-width="3" points="${pts.map(p=>p.join(',')).join(' ')}"/>${dots}<text x="${W/2}" y="${H-4}" text-anchor="middle" fill="#a6b8d0" font-size="12">${xlabel}</text></svg>`;
}
