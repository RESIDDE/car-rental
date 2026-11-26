import './style.css';

new MutationObserver(()=>{for(const c of document.querySelectorAll('.stack td:not([data-l])')){let i=0,p=c;while(p=p.previousElementSibling)i+=p.colSpan;c.dataset.l=c.closest('table').rows[0].cells[i]?.textContent||''}}).observe(document,{childList:true,subtree:true});
{
const $=s=>document.querySelector(s);
const S={cars:[],bookings:[],expenses:[],drivers:[]};
let db=null,loaded=false,filter='active',editing=null,moving=null,carEditing=null,rateTouched=false;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const N=v=>{v=Number(v);return isFinite(v)?v:0};
const naira=v=>(N(v)<0?'−':'')+'₦'+Math.abs(Math.round(N(v))).toLocaleString('en-NG');
const short=v=>{const a=Math.abs(N(v)),s=N(v)<0?'−':'';return a>=1e6?s+'₦'+(a/1e6).toFixed(a>=1e7?0:1)+'m':a>=1e4?s+'₦'+Math.round(a/1e3)+'k':naira(v)};
const pad=n=>String(n).padStart(2,'0');
const isoL=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const TODAY=isoL(new Date());
const ms=s=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s||'');return m?Date.UTC(+m[1],m[2]-1,+m[3]):NaN};
const addD=(s,n)=>new Date(ms(s)+n*864e5).toISOString().slice(0,10);
const diff=(a,b)=>Math.round((ms(b)-ms(a))/864e5);
const fmtD=s=>isNaN(ms(s))?'—':new Date(ms(s)).toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'});
const days=b=>Math.max(1,diff(b.start,b.end)||0);
const total=b=>days(b)*N(b.rate)+N(b.extra);
const bal=b=>total(b)-N(b.paid);
const live=b=>b.status!=='cancelled';
const carOf=id=>S.cars.find(c=>c.id===id);
const carName=id=>(carOf(id)||{}).name||'Removed car';
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const month=TODAY.slice(0,7);
const stateOf=b=>b.status==='out'&&b.end<TODAY?'overdue':(b.status||'booked');
const LBL={booked:'Booked',out:'Out',overdue:'Overdue',returned:'Returned',cancelled:'Cancelled',free:'Available',due:'Pick-up due'};

/* ---- storage: shared database when available, this device otherwise ---- */
const LK='rentaldesk.v1';
const saveLocal=()=>{try{localStorage.setItem(LK,JSON.stringify(S))}catch(e){}};
const loadLocal=()=>{try{const o=JSON.parse(localStorage.getItem(LK)||'null');if(o)for(const k in S)S[k]=Array.isArray(o[k])?o[k]:[]}catch(e){}};
async function put(col,obj){
  const {id,...body}=obj;
  if(db){try{await db.collection(col).doc(id).set(body)}catch(e){toast(e&&e.code==='invalid_argument'?'You can view this dashboard but not change it.':e&&e.code==='quota_exceeded'?'Storage is full — delete some old records.':'Could not save. Check your connection and try again.');throw e}}
  else{const a=S[col],i=a.findIndex(x=>x.id===id);if(i>=0)a[i]=obj;else a.push(obj);saveLocal();render()}
}
async function del(col,id){
  if(db){try{await db.collection(col).doc(id).delete()}catch(e){toast('Could not delete. Try again.');throw e}}
  else{S[col]=S[col].filter(x=>x.id!==id);saveLocal();render()}
}
async function remove(col,obj,what){await del(col,obj.id);toast(what+' deleted',()=>put(col,obj))}

/* ---- toast with undo ---- */
let tT;
function toast(msg,undo){$('#tMsg').textContent=msg;const u=$('#tUndo');u.hidden=!undo;u.onclick=()=>{undo();$('#toast').hidden=true};$('#toast').hidden=false;clearTimeout(tT);tT=setTimeout(()=>$('#toast').hidden=true,undo?7000:4000)}

/* ---- derived ---- */
function carState(c){
  const bs=S.bookings.filter(b=>b.carId===c.id&&live(b));
  const out=bs.find(b=>b.status==='out');
  if(out)return{k:out.end<TODAY?'overdue':'out',b:out};
  const next=bs.filter(b=>b.status==='booked'&&b.end>=TODAY).sort((a,b)=>a.start<b.start?-1:1)[0];
  if(next&&next.start<=TODAY)return{k:'due',b:next};
  return{k:'free',b:next};
}
function rentedDays(b,from,to){if(!live(b)||b.status==='booked'&&b.start>TODAY)return 0;const s=b.start>from?b.start:from,e=b.end<to?b.end:to;return Math.max(0,diff(s,e))}
function monthStats(m){
  const rev=S.bookings.filter(b=>live(b)&&(b.start||'').slice(0,7)===m).reduce((a,b)=>a+total(b),0);
  const cost=S.expenses.filter(x=>(x.date||'').slice(0,7)===m).reduce((a,x)=>a+N(x.amount),0);
  return{rev,cost};
}

/* ---- render ---- */
function render(){
  const cars=S.cars, nC=cars.length;
  const outN=cars.filter(c=>['out','overdue'].includes(carState(c).k)).length;
  const late=cars.filter(c=>carState(c).k==='overdue').length;
  const {rev,cost}=monthStats(month);
  const owed=S.bookings.filter(live).reduce((a,b)=>a+Math.max(0,bal(b)),0);
  const mStart=month+'-01',upto=addD(TODAY,1);
  const used=S.bookings.reduce((a,b)=>a+rentedDays(b,mStart,upto),0);
  const avail=nC*diff(mStart,upto);
  const mName=new Date(ms(mStart)).toLocaleDateString('en-GB',{month:'long',timeZone:'UTC'});
  $('#headline').textContent=!loaded?'Loading your fleet…':nC?`${outN} of ${nC} car${nC>1?'s':''} out today`+(late?` — ${late} overdue`:''):'Add your cars to get started';
  $('#subline').textContent=loaded&&nC?`${naira(rev)} booked in ${mName} · ${naira(owed)} still to collect`:'';
  $('#kRev').textContent=short(rev);$('#kRevL').textContent='Booked in '+mName;
  $('#kNet').textContent=short(rev-cost);$('#kOwed').textContent=short(owed);
  $('#kUse').textContent=avail?Math.round(used/avail*100)+'%':'—';
  renderBoard();renderUpcoming();renderMoney();renderBookings();renderExpenses();renderCars();renderDrivers();renderReport();renderStage();
  const hasSample=S.bookings.some(b=>b.sample)||S.expenses.some(x=>x.sample);
  $('#clearSample').hidden=!hasSample;
  if(hasSample&&!stateNote)$('#state').textContent='These are sample bookings and costs so you can see how it works. Clear them under Cars before you go live.';
  else $('#state').textContent=stateNote;
}
let stateNote='';

function renderBoard(){
  const R0=addD(TODAY,-2),SPAN=14;
  if(!S.cars.length){$('#board').innerHTML=`<div class="empty">${loaded?'No cars yet. Add your first car under <b>Cars</b>.':'Loading…'}</div>`;return}
  const head=Array.from({length:SPAN},(_,i)=>{const d=addD(R0,i),t=new Date(ms(d));return `<span class="${d===TODAY?'t':''}">${t.toLocaleDateString('en-GB',{weekday:'narrow',timeZone:'UTC'})}<br>${t.getUTCDate()}</span>`}).join('');
  $('#board').innerHTML=S.cars.map(c=>{
    const st=carState(c);
    const when=st.k==='out'?`Back ${fmtD(st.b.end)} · ${esc(st.b.customer)}`:st.k==='overdue'?`Was due ${fmtD(st.b.end)} · ${esc(st.b.customer)}`:st.k==='due'?`${esc(st.b.customer)} · ${fmtD(st.b.start)}`:st.b?`Next out ${fmtD(st.b.start)}`:'No upcoming bookings';
    const blocks=S.bookings.filter(b=>b.carId===c.id&&live(b)).map(b=>{
      const l=Math.max(0,diff(R0,b.start)),r=Math.min(SPAN,diff(R0,b.end)+.5);
      if(isNaN(l)||isNaN(r)||r<=0||l>=SPAN||r<=l)return '';
      const k=stateOf(b);
      return `<button type="button" class="blk b-${k}" data-edit="${esc(b.id)}" style="left:calc(${l/SPAN*100}% + 2px);width:calc(${(r-l)/SPAN*100}% - 4px)" title="${esc(b.customer)} · ${fmtD(b.start)}–${fmtD(b.end)} · ${LBL[k]}">${esc((b.customer||'').split(' ')[0])}</button>`}).join('');
    return `<div class="row"><div class="tag"><strong>${esc(c.name)}</strong><span class="plate">${esc(c.plate||'NO PLATE')}</span> <span class="pill p-${st.k}">${LBL[st.k]}</span><span class="when">${when}</span></div><div class="strip"><div class="days">${head}</div>${blocks}</div></div>`}).join('');
}

function renderUpcoming(){
  const items=[];const wk=addD(TODAY,7);
  for(const b of S.bookings){
    if(!live(b))continue;const cn=esc(carName(b.carId)),who=esc(b.customer);
    if(b.status==='out'&&b.end<TODAY)items.push({d:b.end,s:0,t:`<b class="warn">Overdue</b> · ${cn} with ${who}`,a:`<button class="sm" data-in="${esc(b.id)}">Check in</button>`});
    else if(b.status==='out'&&b.end<=wk)items.push({d:b.end,s:1,t:`Return · ${cn} from ${who}`,a:`<button class="sm" data-in="${esc(b.id)}">Check in</button>`});
    else if(b.status==='booked'&&b.start<=wk&&b.end>=TODAY)items.push({d:b.start,s:1,t:`Pick-up · ${cn} for ${who}`,a:`<button class="sm" data-out="${esc(b.id)}">Check out</button>`});
    if(b.status==='returned'&&bal(b)>0)items.push({d:b.end,s:2,t:`<span class="owe">${naira(bal(b))} unpaid</span> · ${who}`,a:`<button class="sm" data-edit="${esc(b.id)}">Record payment</button>`});
  }
  items.sort((a,b)=>a.s-b.s||(a.d<b.d?-1:1));
  $('#upcoming').innerHTML=items.length?items.slice(0,10).map(i=>{const t=new Date(ms(i.d));return `<li><span class="d">${t.getUTCDate()}<small>${t.toLocaleDateString('en-GB',{month:'short',timeZone:'UTC'})}</small></span><span class="w">${i.t}</span>${i.a}</li>`}).join(''):`<li class="note">Nothing due in the next 7 days.</li>`;
}

function renderMoney(){
  const ms6=[];const d=new Date(ms(month+'-01'));
  for(let i=5;i>=0;i--){const x=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()-i,1));ms6.push(x.toISOString().slice(0,7))}
  const rows=ms6.map(m=>({m,...monthStats(m)}));const mx=Math.max(1,...rows.map(r=>Math.max(r.rev,r.cost)));
  $('#months').innerHTML=rows.map(r=>`<div class="r"><span>${new Date(ms(r.m+'-01')).toLocaleDateString('en-GB',{month:'short',timeZone:'UTC'})}</span><span><div class="bar" style="width:${r.rev/mx*100}%"></div><div class="bar c" style="width:${r.cost/mx*100}%"></div></span><span>${short(r.rev)}<br><small style="color:var(--mute)">−${short(r.cost)}</small></span></div>`).join('');
  const per=S.cars.map(c=>{const rv=S.bookings.filter(b=>b.carId===c.id&&live(b)).reduce((a,b)=>a+total(b),0),co=S.expenses.filter(x=>x.carId===c.id).reduce((a,x)=>a+N(x.amount),0);return{c,rv,co}});
  const m2=Math.max(1,...per.map(p=>p.rv));
  $('#byCar').innerHTML=per.length?per.map(p=>`<div class="r" style="grid-template-columns:minmax(0,120px) minmax(0,1fr) 84px"><span title="${esc(p.c.name)}" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.c.name)}</span><span><div class="bar" style="width:${p.rv/m2*100}%"></div><div class="bar c" style="width:${p.co/m2*100}%"></div></span><span>${short(p.rv-p.co)}<br><small style="color:var(--mute)">profit</small></span></div>`).join(''):'<p class="note">No cars yet.</p>';
}

const FILTERS=[['active','Active'],['out','Out'],['returned','Returned'],['unpaid','Unpaid'],['cancelled','Cancelled'],['all','All']];
function shownBookings(){
  const q=$('#q').value.trim().toLowerCase();
  return S.bookings.filter(b=>{
    const k=stateOf(b);
    if(filter==='active'&&!['booked','out','overdue'].includes(k))return false;
    if(filter==='out'&&!['out','overdue'].includes(k))return false;
    if(filter==='returned'&&k!=='returned')return false;
    if(filter==='cancelled'&&k!=='cancelled')return false;
    if(filter==='unpaid'&&!(live(b)&&bal(b)>0))return false;
    return !q||[b.customer,b.phone,carName(b.carId),b.notes].join(' ').toLowerCase().includes(q);
  }).sort((a,b)=>a.start<b.start?1:-1);
}
function renderBookings(){
  $('#chips').innerHTML=FILTERS.map(([k,l])=>`<button class="chip" data-f="${k}" aria-pressed="${filter===k}">${l}</button>`).join(' ');
  const rows=shownBookings();
  $('#bkRows').innerHTML=rows.length?rows.map(b=>{const k=stateOf(b),bl=bal(b);
    const act=b.status==='booked'?`<button class="sm" data-out="${esc(b.id)}">Check out</button>`:b.status==='out'?`<button class="sm" data-in="${esc(b.id)}">Check in</button>`:'';
    return `<tr><td>${esc(carName(b.carId))}<br><small class="note">${esc(drvName(b.driverId))}</small></td><td>${esc(b.customer)}${b.sample?'<span class="sample" title="Sample"></span>':''}${b.phone?`<br><small class="note">${esc(b.phone)}</small>`:''}</td><td class="nw">${fmtD(b.start)} – ${fmtD(b.end)}</td><td class="num">${days(b)}</td><td class="num">${naira(total(b))}</td><td class="num">${naira(b.paid)}</td><td class="num ${bl>0&&live(b)?'owe':''}">${live(b)?naira(bl):'—'}</td><td><span class="pill p-${k}">${LBL[k]}</span></td><td><div class="acts">${act}<button class="sm" data-edit="${esc(b.id)}">Edit</button></div></td></tr>`}).join(''):`<tr><td colspan="9" class="note" style="padding:20px 8px">No bookings here yet. Tap “+ New booking” to add one.</td></tr>`;
}
function renderExpenses(){
  const sel=$('#exCar'),v=sel.value;
  sel.innerHTML='<option value="">General (not one car)</option>'+S.cars.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');sel.value=v;
  if(!$('#exDate').value)$('#exDate').value=TODAY;
  const rows=[...S.expenses].sort((a,b)=>a.date<b.date?1:-1);
  $('#exRows').innerHTML=rows.length?rows.map(x=>`<tr><td class="nw">${fmtD(x.date)}</td><td>${x.carId?esc(carName(x.carId)):'General'}</td><td>${esc(x.category)}${x.sample?'<span class="sample" title="Sample"></span>':''}</td><td>${esc(x.note)}</td><td class="num">${naira(x.amount)}</td><td><div class="acts"><button class="sm dang" data-xdel="${esc(x.id)}">Delete</button></div></td></tr>`).join(''):`<tr><td colspan="6" class="note" style="padding:20px 8px">No costs recorded yet.</td></tr>`;
}
function renderCars(){
  $('#cars').innerHTML=S.cars.length?S.cars.map(c=>{const bs=S.bookings.filter(b=>b.carId===c.id&&live(b));const rv=bs.reduce((a,b)=>a+total(b),0),co=S.expenses.filter(x=>x.carId===c.id).reduce((a,x)=>a+N(x.amount),0);const dy=bs.filter(b=>b.status!=='booked').reduce((a,b)=>a+days(b),0);const st=carState(c);
    return `<div class="card"><strong style="font-size:18px">${esc(c.name)}</strong><br><span class="plate">${esc(c.plate||'NO PLATE')}</span> <span class="pill p-${st.k}">${LBL[st.k]}</span><dl><dt>Daily rate</dt><dd>${naira(c.rate)}</dd><dt>Rentals</dt><dd>${bs.length}</dd><dt>Days rented</dt><dd>${dy}</dd><dt>Earned</dt><dd>${naira(rv)}</dd><dt>Costs</dt><dd>${naira(co)}</dd><dt>Profit</dt><dd><b>${naira(rv-co)}</b></dd></dl><button class="sm" data-car="${esc(c.id)}">Edit</button> <button class="sm" data-hist="${esc(c.name)}">History</button></div>`}).join(''):`<div class="empty">${loaded?'No cars yet — add the first one.':'Loading…'}</div>`;
}

/* ---- booking dialog ---- */
const F=id=>$('#'+id);
function openBooking(b){
  if(!S.cars.length){toast('Add a car first, under Cars.');location.hash='fleet';return}
  editing=b||null;rateTouched=!!b;
  F('bkTitle').textContent=b?'Edit booking':'New booking';
  F('fCar').innerHTML=S.cars.map(c=>`<option value="${esc(c.id)}">${esc(c.name)} — ${naira(c.rate)}/day</option>`).join('');
  const d=b||{carId:S.cars[0].id,status:'booked',start:TODAY,end:addD(TODAY,1),rate:S.cars[0].rate};
  F('fCar').value=d.carId;F('fStatus').value=d.status||'booked';F('fName').value=d.customer||'';F('fPhone').value=d.phone||'';
  F('fStart').value=d.start||'';F('fEnd').value=d.end||'';F('fRate').value=d.rate??'';F('fExtra').value=d.extra||'';
  F('fPaid').value=d.paid||'';F('fDep').value=d.deposit||'';F('fOdoOut').value=d.odoOut||'';F('fOdoIn').value=d.odoIn||'';F('fNotes').value=d.notes||'';F('fDriver').innerHTML='<option value="">Self-drive (no driver)</option>'+S.drivers.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('');F('fDriver').value=d.driverId||'';F('fIdNo').value=d.idNo||'';
  F('fDel').hidden=!b;bkSum();F('bkDlg').showModal();
}
function formBooking(){return{id:editing?editing.id:uid(),carId:F('fCar').value,status:F('fStatus').value,customer:F('fName').value.trim(),phone:F('fPhone').value.trim(),start:F('fStart').value,end:F('fEnd').value,rate:N(F('fRate').value),extra:N(F('fExtra').value),paid:N(F('fPaid').value),deposit:N(F('fDep').value),odoOut:F('fOdoOut').value?N(F('fOdoOut').value):null,odoIn:F('fOdoIn').value?N(F('fOdoIn').value):null,notes:F('fNotes').value.trim(),driverId:F('fDriver').value,idNo:F('fIdNo').value.trim(),created:editing&&editing.created||new Date().toISOString(),...(editing&&editing.sample?{sample:true}:{})}}
function clash(b){return S.bookings.find(o=>o.id!==b.id&&o.carId===b.carId&&live(o)&&o.status!=='returned'&&b.status!=='cancelled'&&o.start<b.end&&b.start<o.end)}
function bkSum(){
  const b=formBooking();
  if(b.end&&b.start&&b.end<b.start){F('fSum').innerHTML='<span class="warn">Return date is before pick-up date.</span>';return}
  const c=clash(b);const km=b.odoIn&&b.odoOut?` · ${(b.odoIn-b.odoOut).toLocaleString('en-NG')} km driven`:'';
  F('fSum').innerHTML=`${days(b)} day${days(b)>1?'s':''} × ${naira(b.rate)}${b.extra?` + ${naira(b.extra)} extra`:''} = <b>${naira(total(b))}</b> · balance <b class="${bal(b)>0?'owe':''}">${naira(bal(b))}</b>${km}`+(dClash(b)?`<br><span class="warn">${esc(drvName(b.driverId))} is already on another trip then.</span>`:'')+(c?`<br><span class="warn">Clashes with ${esc(c.customer)}'s booking (${fmtD(c.start)}–${fmtD(c.end)}).</span>`:'');
}
F('fCar').addEventListener('change',()=>{if(!rateTouched){const c=carOf(F('fCar').value);if(c)F('fRate').value=c.rate}bkSum()});
F('fRate').addEventListener('input',()=>rateTouched=true);
F('bkForm').addEventListener('input',bkSum);
F('fStart').addEventListener('change',()=>{if(F('fEnd').value<=F('fStart').value)F('fEnd').value=addD(F('fStart').value,1);bkSum()});
F('bkForm').addEventListener('submit',async e=>{e.preventDefault();const b=formBooking();if(b.end<b.start){bkSum();return}
  try{await put('bookings',b);F('bkDlg').close();toast(editing?'Booking updated':'Booking saved')}catch(_){}});
F('fCancel').onclick=()=>F('bkDlg').close();
F('fDel').onclick=async()=>{const b=editing;F('bkDlg').close();try{await remove('bookings',b,'Booking')}catch(_){}};

/* ---- check out / check in ---- */
function openMove(b,dir){
  moving={b,dir};const out=dir==='out';
  F('mvTitle').textContent=out?'Check out':'Check in';
  F('mvWho').textContent=`${carName(b.carId)} · ${b.customer}`;
  F('mvDateL').firstChild.textContent=out?'Pick-up date':'Returned on';
  F('mDate').value=out?(b.start>TODAY?TODAY:b.start):TODAY;
  F('mOdo').value=(out?b.odoOut:b.odoIn)||'';F('mPaid').value=b.paid||'';F('mExtra').value=b.extra||'';
  F('mExtraL').hidden=out;F('mGo').textContent=out?'Hand over keys':'Car is back';mvSum();F('mvDlg').showModal();
}
function moved(){const{b,dir}=moving,o={...b};if(dir==='out'){o.status='out';o.start=F('mDate').value;if(o.end<=o.start)o.end=addD(o.start,1);o.odoOut=F('mOdo').value?N(F('mOdo').value):b.odoOut??null}else{o.status='returned';o.end=F('mDate').value<=o.start?addD(o.start,1):F('mDate').value;o.odoIn=F('mOdo').value?N(F('mOdo').value):b.odoIn??null;o.extra=N(F('mExtra').value)}o.paid=N(F('mPaid').value);return o}
function mvSum(){const o=moved(),late=moving.dir==='in'?diff(moving.b.end,o.end):0;F('mSum').innerHTML=`${days(o)} day${days(o)>1?'s':''} · total <b>${naira(total(o))}</b> · balance <b class="${bal(o)>0?'owe':''}">${naira(bal(o))}</b>`+(late>0?`<br><span class="warn">${late} day${late>1?'s':''} late — charged at the daily rate.</span>`:'')}
F('mvForm').addEventListener('input',mvSum);
F('mCancel').onclick=()=>F('mvDlg').close();
F('mvForm').addEventListener('submit',async e=>{e.preventDefault();const o=moved();try{await put('bookings',o);F('mvDlg').close();toast(o.status==='out'?'Checked out':'Checked in')}catch(_){}});

/* ---- cars ---- */
function openCar(c){carEditing=c||null;F('carTitle').textContent=c?'Edit car':'Add a car';F('cName').value=c?c.name:'';F('cPlate').value=c?c.plate||'':'';F('cRate').value=c?c.rate:'';F('cDel').hidden=!c;F('carDlg').showModal()}
F('carForm').addEventListener('submit',async e=>{e.preventDefault();const c={...(carEditing||{}),id:carEditing?carEditing.id:uid(),name:F('cName').value.trim(),plate:F('cPlate').value.trim().toUpperCase(),rate:N(F('cRate').value)};try{await put('cars',c);F('carDlg').close();toast('Car saved')}catch(_){}});
F('cCancel').onclick=()=>F('carDlg').close();
F('cDel').onclick=async()=>{const c=carEditing;F('carDlg').close();try{await remove('cars',c,'Car')}catch(_){}};
F('addCar').onclick=()=>openCar();
F('clearSample').onclick=async()=>{const bs=S.bookings.filter(b=>b.sample),xs=S.expenses.filter(x=>x.sample);try{for(const b of bs)await del('bookings',b.id);for(const x of xs)await del('expenses',x.id);toast('Sample data cleared',async()=>{for(const b of bs)await put('bookings',b);for(const x of xs)await put('expenses',x)})}catch(_){}};

/* ---- expenses ---- */
F('exForm').addEventListener('submit',async e=>{e.preventDefault();const x={id:uid(),carId:F('exCar').value,date:F('exDate').value,category:F('exCat').value,amount:N(F('exAmt').value),note:F('exNote').value.trim()};try{await put('expenses',x);F('exAmt').value='';F('exNote').value='';toast('Cost added')}catch(_){}});

/* ---- clicks, search, csv, tabs ---- */
document.addEventListener('click',e=>{
  const t=e.target.closest('[data-edit],[data-out],[data-in],[data-car],[data-f],[data-xdel],[data-drv],[data-hist],[data-rp]');if(!t)return;const d=t.dataset;
  const bk=id=>S.bookings.find(b=>b.id===id);
  if(d.edit&&bk(d.edit))openBooking(bk(d.edit));
  else if(d.out&&bk(d.out))openMove(bk(d.out),'out');
  else if(d.in&&bk(d.in))openMove(bk(d.in),'in');
  else if(d.car)openCar(carOf(d.car));
  else if(d.f){filter=d.f;renderBookings()}
  else if(d.drv)openDrv(S.drivers.find(x=>x.id===d.drv));
  else if(d.hist!==undefined){F('q').value=d.hist;filter='all';location.hash='bookings';renderBookings()}
  else if(d.rp){rp=d.rp;renderReport()}
  else if(d.xdel){const x=S.expenses.find(x=>x.id===d.xdel);if(x)remove('expenses',x,'Cost').catch(()=>{})}
});
F('newBk').onclick=()=>openBooking();
F('q').addEventListener('input',renderBookings);
F('csv').onclick=async()=>{
  const q=v=>`"${String(v??'').replace(/"/g,'""')}"`;
  const lines=[['Car','Plate','Driver','Customer','Phone','Pick-up','Return','Days','Daily rate','Extra','Total','Paid','Balance','Deposit','Status','Odometer out','Odometer in','Notes'].join(',')].concat(shownBookings().map(b=>{const c=carOf(b.carId)||{};return[c.name,c.plate,drvName(b.driverId),b.customer,b.phone,b.start,b.end,days(b),b.rate,N(b.extra),total(b),N(b.paid),bal(b),N(b.deposit),LBL[stateOf(b)],b.odoOut,b.odoIn,b.notes].map(q).join(',')}));
  const txt=lines.join('\n');try{await navigator.clipboard.writeText(txt);toast('Copied — paste into Excel or Google Sheets')}catch(_){const a=F('csvOut');a.hidden=false;a.value=txt;a.select();toast('Select all and copy the text below')}
};
const TABS=['overview','bookings','expenses','fleet','drivers','reports'];
function route(){const h=location.hash.slice(1);const cur=TABS.includes(h)?h:'overview';for(const t of TABS)F(t).hidden=t!==cur;document.querySelectorAll('nav a').forEach(a=>a.toggleAttribute('aria-current',a.getAttribute('href')==='#'+cur)&&a.setAttribute('aria-current','page'))}
window.addEventListener('hashchange',route);route();

/* ---- drivers ---- */
const sum=(a,f)=>a.reduce((s,x)=>s+N(f(x)),0);
const drvName=id=>id?((S.drivers.find(d=>d.id===id)||{}).name||'Removed driver'):'Self-drive';
function dClash(b){return b.driverId&&b.status!=='cancelled'&&S.bookings.find(o=>o.id!==b.id&&o.driverId===b.driverId&&live(o)&&o.status!=='returned'&&o.start<b.end&&b.start<o.end)}
let drvEditing=null;
function openDrv(d){drvEditing=d||null;F('drvTitle').textContent=d?'Edit driver':'Add a driver';F('dName').value=d?d.name:'';F('dPhone').value=d?d.phone||'':'';F('dLic').value=d?d.licence||'':'';F('dDel').hidden=!d;F('drvDlg').showModal()}
F('addDrv').onclick=()=>openDrv();
F('dCancel').onclick=()=>F('drvDlg').close();
F('drvForm').addEventListener('submit',async e=>{e.preventDefault();const d={...(drvEditing||{}),id:drvEditing?drvEditing.id:uid(),name:F('dName').value.trim(),phone:F('dPhone').value.trim(),licence:F('dLic').value.trim()};try{await put('drivers',d);F('drvDlg').close();toast('Driver saved')}catch(_){}});
F('dDel').onclick=async()=>{const d=drvEditing;F('drvDlg').close();try{await remove('drivers',d,'Driver')}catch(_){}};
function renderDrivers(){
  F('drvs').innerHTML=S.drivers.length?S.drivers.map(d=>{const mine=S.bookings.filter(b=>b.driverId===d.id&&live(b)),on=mine.find(b=>b.status==='out'),done=mine.filter(b=>b.status!=='booked');
    return `<div class="card"><strong style="font-size:18px">${esc(d.name)}</strong><br><span class="pill ${on?'p-out':'p-free'}" style="margin-top:6px">${on?'On a trip':'Available'}</span><dl><dt>Phone</dt><dd>${esc(d.phone||'—')}</dd><dt>Licence</dt><dd>${esc(d.licence||'—')}</dd>${on?`<dt>Now driving</dt><dd>${esc(carName(on.carId))}</dd><dt>Back</dt><dd>${fmtD(on.end)}</dd>`:''}<dt>Trips</dt><dd>${done.length}</dd><dt>Days driven</dt><dd>${sum(done,days)}</dd><dt>Revenue on trips</dt><dd><b>${naira(sum(mine,total))}</b></dd></dl><button class="sm" data-drv="${esc(d.id)}">Edit</button> <button class="sm" data-hist="${esc(d.name)}">Trips</button></div>`}).join(''):`<div class="empty">No drivers yet. Add your drivers, then pick one on each booking.</div>`;
}

/* ---- reports ---- */
let rp='month';
const RP=[['today','Today'],['month','This month'],['last','Last month'],['year','This year'],['all','All time']];
function range(){
  const y=TODAY.slice(0,4);
  if(rp==='today')return[TODAY,TODAY,'Today, '+fmtD(TODAY)];
  if(rp==='month')return[month+'-01',month+'-31',new Date(ms(month+'-01')).toLocaleDateString('en-GB',{month:'long',year:'numeric',timeZone:'UTC'})];
  if(rp==='last'){const lm=addD(month+'-01',-1).slice(0,7);return[lm+'-01',lm+'-31',new Date(ms(lm+'-01')).toLocaleDateString('en-GB',{month:'long',year:'numeric',timeZone:'UTC'})]}
  if(rp==='year')return[y+'-01-01',y+'-12-31','Year '+y];
  if(rp==='custom'){const a=F('rFrom').value||'0000-01-01',z=F('rTo').value||'9999-12-31';return[a,z,(F('rFrom').value?fmtD(a):'Start')+' – '+(F('rTo').value?fmtD(z):'now')]}
  return['0000-01-01','9999-12-31','All time'];
}
const tbl=(heads,rows,empty)=>`<div class="scroll"><table class="stack"><thead><tr>${heads.map(h=>`<th${h[1]?' class="num"':''}>${h[0]}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.join(''):`<tr><td colspan="${heads.length}" class="note" style="padding:18px 8px">${empty}</td></tr>`}</tbody></table></div>`;
const tr=cells=>`<tr>${cells.map(c=>Array.isArray(c)?`<td class="num">${c[0]}</td>`:`<td>${c}</td>`).join('')}</tr>`;
function renderReport(){
  F('rChips').innerHTML=RP.map(([k,l])=>`<button class="chip" data-rp="${k}" aria-pressed="${rp===k}">${l}</button>`).join(' ');
  const[a,z,label]=range();const inR=s=>s&&s>=a&&s<=z;
  F('rTitle').textContent='Report · '+label;
  const bs=S.bookings.filter(b=>live(b)&&inR(b.start)),xs=S.expenses.filter(x=>inR(x.date));
  const rev=sum(bs,total),paid=sum(bs,b=>b.paid),owed=sum(bs,b=>Math.max(0,bal(b))),cost=sum(xs,x=>x.amount),dys=sum(bs,days);
  F('rKpis').innerHTML=[['Revenue',short(rev)],['Collected',short(paid)],['Outstanding',short(owed)],['Costs',short(cost)],['Profit',short(rev-cost)],['Trips',bs.length],['Rental days',dys],['Avg per day',short(dys?rev/dys:0)]].map(([l,v])=>`<div><div class="fig-n">${v}</div><small>${l}</small></div>`).join('');
  F('rCar').innerHTML=tbl([['Car'],['Trips',1],['Days',1],['Revenue',1],['Costs',1],['Profit',1]],
    S.cars.map(c=>{const m=bs.filter(b=>b.carId===c.id),co=sum(xs.filter(x=>x.carId===c.id),x=>x.amount),r=sum(m,total);return{c,m,co,r}}).sort((p,q)=>q.r-p.r)
    .map(({c,m,co,r})=>tr([`${esc(c.name)}<br><span class="plate">${esc(c.plate||'NO PLATE')}</span>`,[m.length],[sum(m,days)],[naira(r)],[naira(co)],[`<b>${naira(r-co)}</b>`]])),'No cars yet.');
  const grp=key=>{const g=new Map();for(const b of bs){const k=key(b);const o=g.get(k)||{k,b:[]};o.b.push(b);g.set(k,o)}return[...g.values()].sort((p,q)=>sum(q.b,total)-sum(p.b,total))};
  F('rDrv').innerHTML=tbl([['Driver'],['Trips',1],['Days',1],['Revenue',1]],grp(b=>b.driverId||'').map(g=>tr([esc(drvName(g.k)),[g.b.length],[sum(g.b,days)],[naira(sum(g.b,total))]])),'No trips in this period.');
  F('rCust').innerHTML=tbl([['Customer'],['Trips',1],['Spent',1],['Owes',1]],grp(b=>(b.customer||'').trim().toLowerCase()).slice(0,10).map(g=>{const o=sum(g.b,b=>Math.max(0,bal(b)));return tr([`${esc(g.b[0].customer)}${g.b[0].phone?`<br><small class="note">${esc(g.b[0].phone)}</small>`:''}`,[g.b.length],[naira(sum(g.b,total))],[o?`<span class="owe">${naira(o)}</span>`:'—']])}),'No customers in this period.');
  const cats={};for(const x of xs)cats[x.category]=(cats[x.category]||0)+N(x.amount);
  F('rCost').innerHTML=tbl([['Type'],['Amount',1],['Share',1]],Object.entries(cats).sort((p,q)=>q[1]-p[1]).map(([k,v])=>tr([esc(k),[naira(v)],[Math.round(v/cost*100)+'%']])),'No costs in this period.');
  F('rLog').innerHTML=tbl([['Dates'],['Car'],['Driver'],['Customer'],['Days',1],['Total',1],['Paid',1],['Balance',1],['Status']],
    [...bs].sort((p,q)=>p.start<q.start?-1:1).map(b=>{const k=stateOf(b),bl=bal(b);return tr([`<span class="nw">${fmtD(b.start)} – ${fmtD(b.end)}</span>`,esc(carName(b.carId)),esc(drvName(b.driverId)),`${esc(b.customer)}${b.idNo?`<br><small class="note">ID ${esc(b.idNo)}</small>`:''}`,[days(b)],[naira(total(b))],[naira(b.paid)],[bl>0?`<span class="owe">${naira(bl)}</span>`:naira(bl)],`<span class="pill p-${k}">${LBL[k]}</span>`])}),'No trips in this period.');
}
F('rFrom').addEventListener('change',()=>{rp='custom';renderReport()});
F('rTo').addEventListener('change',()=>{rp='custom';renderReport()});
F('rPrint').onclick=()=>window.print();

/* ---- 3D stage ---- */
let si=0;
const STL={free:'Available',out:'Out with customer',overdue:'Overdue!',due:'Pick-up due'};
function renderStage(){
  const n=S.cars.length;if(!n){F('sName').textContent='No cars yet';F('sPlate').textContent='Add one under Fleet';F('sState').textContent='—';F('sRev').textContent='—';F('sDays').textContent='—';return}
  si=(si+n)%n;const c=S.cars[si],st=carState(c),bs=S.bookings.filter(b=>b.carId===c.id&&live(b));
  F('sName').textContent=c.name;F('sPlate').textContent=(c.plate||'No plate')+` · ${si+1}/${n}`;
  F('sState').textContent=STL[st.k]+(st.b&&st.k!=='free'?' · '+drvName(st.b.driverId):'');F('sState').dataset.k=st.k;
  F('sRev').textContent=naira(sum(bs,total));F('sDays').textContent=sum(bs.filter(b=>b.status!=='booked'),days)+' days';
  window.dispatchEvent(new CustomEvent('stagecar',{detail:{i:si,id:c.id}}));
}
F('sPrev').onclick=()=>{si--;renderStage()};F('sNext').onclick=()=>{si++;renderStage()};
const tick=()=>{const d=new Date();F('clock').textContent=d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});F('today').textContent=d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})};tick();setInterval(tick,15000);

/* ---- start ---- */
render();
(async()=>{
  let d=null;try{d=window.claude&&window.claude.use?await window.claude.use('db'):null}catch(_){d=null}
  if(!d){loadLocal();loaded=true;stateNote='Saved on this device.';render();return}
  db=d;const got={};let firm=0;
  const timer=setTimeout(()=>{stateNote='Can’t reach the saved data yet — figures may be out of date.';loaded=true;render()},10000);
  for(const col of Object.keys(S)){
    db.collection(col).onSnapshot(snap=>{
      S[col]=snap.docs.map(x=>({...x.data(),id:x.id}));got[col]=1;
      if(!snap.metadata.fromCache&&!(firm&1<<Object.keys(S).indexOf(col))){firm|=1<<Object.keys(S).indexOf(col)}
      if(firm===(1<<Object.keys(S).length)-1){clearTimeout(timer);if(stateNote.startsWith('Can'))stateNote=''}
      loaded=Object.keys(got).length===Object.keys(S).length;render();
    },e=>{clearTimeout(timer);stateNote='Saved data is unavailable right now.';loaded=true;render()});
  }
})();
}
