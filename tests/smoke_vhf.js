/* Big tables, and rows another app wrote.
   Three things have to hold, and each of them is a way a flight's log could be lost:
     - a table past a megabyte is read whole, not as an empty one
     - a read that comes back short is never written back
     - rows the radio app filed survive everything the crew does, and are shown
   The GitHub stand-in below behaves the way the real one does past a megabyte: the metadata
   answer carries the sha and the size but no content, and the body has to be asked for again
   with the raw media type. */
const fs=require('fs'),{JSDOM}=require('jsdom');
const FILE='/home/claude/gb_notion_frontend/index.html';
const html=fs.readFileSync(FILE,'utf8');

const CALLS=[];
const iso=(h,m,s)=>'2026-11-16T'+String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')
  +':'+String(s).padStart(2,'0')+'.000Z';
/* a crew row */
const crew=(i,type)=>({id:'c'+i,flight_id:'GB-2026-07',callsign:'HB-QXY',seq:i,
  device:'D7K2',device_mode:'shared',reporter:'Balthasar',source:'basket',
  ts_utc:iso(6,Math.floor(i/60)%60,i%60),ts_local:iso(7,Math.floor(i/60)%60,i%60),
  type:type||'POS',pos_lat:'47 12.345N',pos_lon:'008 33.210E',
  lat:47+i/10000,lon:8+i/10000,alt_ft:3280+i,alt_gps_m:1000+i,gps_acc_m:8,gps_age_s:2,
  gps_fix:'3d',pos_source:'gps',place:'near Lucerne, Switzerland',
  tc_deg:214,speed_kt:18,vs_ms:-0.4,
  note:'crew entry '+i+' \u2014 written from the basket on a long competition flight'});
/* one the radio app filed */
const vhf=(i,note)=>({id:'k'+i,flight_id:'GB-2026-07',callsign:'HB-QXY',seq:5000+i,
  reporter:'KRT2',source:'krt2',ts_utc:iso(7,Math.floor(i/60)%60,i%60),type:'VHF',
  atc_dir:'TX',atc_freq:'127.800',atc_station:'ZURICH F',
  lat:47.5,lon:8.5,alt_ft:4000,alt_gps_m:1220,
  note:note||'FRQ 127.800 ZURICH F active'});

/* the table in the repository, which the fake GitHub hands out and takes back */
let FILES={};
const put=(p,text)=>{FILES[p]={text,sha:'sha'+Math.random().toString(36).slice(2,10)}};
let FAIL=null;        /* 'empty' | 'broken' | 'forbid' | null */

function fakeFetch(u,opt){
  u=String(u);opt=opt||{};
  const met=(opt.method||'GET').toUpperCase();
  const acc=(opt.headers&&(opt.headers.Accept||opt.headers.accept))||'';
  const path=decodeURI((u.split('/contents/')[1]||'').split('?')[0]);
  CALLS.push({url:u,method:met,accept:acc,path,body:opt.body?JSON.parse(opt.body):null});
  const J=(x,st)=>Promise.resolve({ok:(st||200)<400,status:st||200,
    headers:{get:()=>null},json:()=>Promise.resolve(x),text:()=>Promise.resolve(JSON.stringify(x))});
  const T=(x,st)=>Promise.resolve({ok:(st||200)<400,status:st||200,
    headers:{get:()=>null},text:()=>Promise.resolve(x),json:()=>Promise.resolve({})});
  if(met==='PUT'){
    const txt=Buffer.from(opt.body?JSON.parse(opt.body).content:'','base64').toString('utf8');
    put(path,txt);
    return J({content:{sha:FILES[path].sha}});
  }
  if(met==='DELETE'){delete FILES[path];return J({ok:true})}
  if(/\/repos\/[^/]+\/[^/?]+$/.test(u))return J({full_name:'bwicki/gb_flight_data',permissions:{push:true}});
  /* a folder */
  if(path==='data'&&!/\.(json|csv)$/.test(path))
    return J(Object.keys(FILES).map(p=>({type:'file',name:p.replace(/^data\//,''),path:p,
      sha:FILES[p].sha,size:Buffer.byteLength(FILES[p].text)})));
  const f=FILES[path];
  if(!f)return J({message:'Not Found'},404);
  const size=Buffer.byteLength(f.text);
  if(FAIL==='forbid'&&/\.json$/.test(path)&&!/_setup|_flights|deleted/.test(path)){
    /* the answer that refuses the file outright; the body is still to be had as raw */
    if(/raw/.test(acc))return T(f.text);
    return J({message:'too large'},403);
  }
  const flight=/GB-2026-07\.json$/.test(path);
  if(FAIL&&flight){
    if(/raw/.test(acc))return FAIL==='empty'?T(''):T('[{"id":"x", NOT JSON');
    /* the shape GitHub sends past a megabyte: metadata, no content */
    return J({sha:f.sha,size,encoding:'none',content:''});
  }
  if(/raw/.test(acc))return T(f.text);
  /* GitHub stops embedding the content past a megabyte */
  if(size>1024*1024)return J({sha:f.sha,size,encoding:'none',content:''});
  return J({sha:f.sha,size,encoding:'base64',content:Buffer.from(f.text,'utf8').toString('base64')});
}

const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,
  url:'https://reporting.wicki.aero/',
  beforeParse(w){
    w.SpeechSynthesisUtterance=function(t){this.text=t};
    w.speechSynthesis={speak(){},cancel(){},getVoices(){return[]}};
    w.AudioContext=function(){this.state='running';this.currentTime=0;
      this.createOscillator=()=>({frequency:{value:0},connect(){},start(){},stop(){}});
      this.createGain=()=>({gain:{value:0,exponentialRampToValueAtTime(){}},connect(){}});
      this.destination={};this.resume=()=>{}};
    w.navigator.geolocation={watchPosition(){return 1},getCurrentPosition(){}};
    w.fetch=fakeFetch;
    w.open=()=>null;
    w.localStorage.setItem('bsk.dev','DTEST');
    w.localStorage.setItem('bsk.cfg.v6',JSON.stringify({repo:'bwicki/gb_flight_data',token:'W',
      dir:'data',branch:'main',role:'master',flight:'GB-2026-07',call:'HB-QXY',lang:'en',
      reporter:'Balthasar',p1:'Balthasar',p2:'Nicole',mode:'shared',provisioned:1}));
    try{Object.defineProperty(w.crypto,'subtle',
      {value:require('crypto').webcrypto.subtle,configurable:true})}catch(e){
      w.crypto=require('crypto').webcrypto}
  }});
const w=dom.window,d=w.document;
let bad=0;const OUT=[];
const say=m=>{OUT.push(m);fs.writeFileSync('/home/claude/vhf.log',OUT.join('\n')+'\n')};
const ok=(c,m)=>{if(!c)bad++;say((c?'  ok  ':'FAIL  ')+m)};
const E=x=>w.eval(x);
const S=(k,v)=>w.eval('CFG.'+k+'='+JSON.stringify(v));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const m=()=>d.getElementById('modal');
const txt=()=>m().textContent.replace(/\s+/g,' ').trim();
const close=async()=>{const b=m().querySelector('[data-a="0"]')||m().querySelector('[data-a="1"]');
  if(b)b.click();await sleep(150)};
const table=()=>JSON.parse(FILES['data/GB-2026-07.json'].text);

(async()=>{
await sleep(600);
S('repo','bwicki/gb_flight_data');S('token','W');S('dir','data');S('branch','main');
S('role','master');S('flight','GB-2026-07');S('call','HB-QXY');S('lang','en');
E('save(K_CFG,CFG)');E('ENT=[];TOMB=[];save(K_ENT,ENT);save(K_TOMB,TOMB)');

/* ─────────────────────────────────────────────────────────────────────── */
say('— a table bigger than a megabyte —');
const big=[];
for(let i=0;i<2300;i++)big.push(crew(i,['POS','ATC','Other','Ballast'][i%4]));
for(let i=0;i<300;i++)big.push(vhf(i));
put('data/GB-2026-07.json',JSON.stringify(big,null,1));
put('data/_flights.json','[]');
const bytes=Buffer.byteLength(FILES['data/GB-2026-07.json'].text);
ok(bytes>1024*1024,'the stand-in file really is past a megabyte: '+(bytes/1048576).toFixed(2)+' MB');
ok(big.length===2600,'2600 rows in it, 300 of them the radio app’s');

const g=await E('ghGet')('data/GB-2026-07.json');
ok(g&&g.sha,'the read brings the sha back');
ok(g.size===bytes,'and the size GitHub reported, got '+g.size);
ok(JSON.parse(g.text).length===2600,'and all 2600 rows, got '+(g.text?JSON.parse(g.text).length:0));
const rawCalls=CALLS.filter(c=>/raw/.test(c.accept));
ok(rawCalls.length===1,'which took one second look with the raw media type, got '+rawCalls.length);

say('— one entry on top of it —');
CALLS.length=0;
await E('sync')(true,false);await sleep(400);
ok(E('ENT.length')===2600,'the device reads the whole table in, got '+E('ENT.length'));
E(`ENT.push({id:'mine-1',flight_id:'GB-2026-07',callsign:'HB-QXY',seq:9001,reporter:'Balthasar',
  source:'basket',ts_utc:'2026-11-16T09:00:00.000Z',type:'Other',note:'by hand',synced:false});
  save(K_ENT,ENT)`);
await E('sync')(true,true);await sleep(900);
const after=table();
ok(after.length===2601,'the table on the server holds 2601 rows, got '+after.length);
ok(after.filter(x=>x.type==='VHF').length===300,
   'every one of the radio app’s rows is still there, got '+after.filter(x=>x.type==='VHF').length);
ok(after.some(x=>x.id==='mine-1'),'and the new entry is in it');
ok(after.filter(x=>x.source==='krt2').length===300,'their source is untouched');

/* ─────────────────────────────────────────────────────────────────────── */
say('— a read that comes back empty is never written back —');
const before=table().length;
CALLS.length=0;FAIL='empty';
E(`ENT.push({id:'mine-2',flight_id:'GB-2026-07',callsign:'HB-QXY',seq:9002,reporter:'Balthasar',
  source:'basket',ts_utc:'2026-11-16T09:05:00.000Z',type:'Other',note:'second',synced:false});
  save(K_ENT,ENT)`);
await E('sync')(true,true);await sleep(600);
ok(table().length===before,'the table is untouched, still '+table().length+' rows');
ok(!CALLS.some(c=>c.method==='PUT'),'nothing was written at all');
ok(/Refused to write/.test(E('LASTERR')),'and it says why: '+E('LASTERR').slice(0,90));
ok(d.getElementById('syncNote').classList.contains('lost'),'the footer carries the refusal');
ok(/Refused to write/.test(d.getElementById('syncNote').textContent),'and shows it standing');
ok(m().classList.contains('on'),'a window offers the text to copy');
ok(/copy/i.test(txt()),'with a copy button: '+txt().slice(0,70));
await close();
ok(E('ENT.some(e=>!e.synced)'),'what was waiting is still waiting');
ok(!E('ENT.some(e=>e.failed)'),'and is not marked as refused by the network, because it never went');

say('— nor one that comes back as nonsense —');
FAIL='broken';
await E('sync')(true,true);await sleep(600);
ok(table().length===before,'still untouched');
ok(!CALLS.some(c=>c.method==='PUT'),'still nothing written');
ok(E('LOSTWARN')===true,'and the window is not opened a second time for the same trouble');

say('— and the refusal clears when a read works again —');
FAIL=null;
await E('sync')(true,true);await sleep(900);
ok(E('LASTERR')==='','the error is gone');
ok(E('LOSTWARN')===false,'and the next spell of trouble would be shown again');
ok(table().length===before+1,'the entry that was held back is now written, '+table().length+' rows');
ok(table().filter(x=>x.type==='VHF').length===300,'with the radio app’s rows intact');

say('— the floor under the merge —');
/* As the merge is written it starts from what was read and only ever adds, so this guard
   cannot fire through sync(); the rule it applies is what there is to check. */
const F=E('floorRows');
const three=[{id:'a'},{id:'b'},{id:'c'}];
ok(F(three,new Set())===3,'three rows read, three must survive');
ok(F(three,new Set(['b']))===2,'a tombstone for one lowers it to two');
ok(F(three.concat([{id:'a'}]),new Set())===3,'the same id twice is still one row');
ok(F(three.concat([{note:'no id'}]),new Set())===3,'a row without an id is not counted');
ok(F([],new Set())===0&&F(null,new Set())===0,'nothing read, nothing to protect');

say('— and a tombstone really does take rows out —');
CALLS.length=0;E('LASTERR="";LOSTWARN=false');
const gone=table().filter(x=>x.type==='VHF').map(x=>({id:x.id,ts:'2026-11-16T09:10:00.000Z',by:'Balthasar'}));
E('TOMB='+JSON.stringify(gone)+';save(K_TOMB,TOMB)');
await E('sync')(true,true);await sleep(1400);
ok(CALLS.some(c=>c.method==='PUT'),'it writes');
ok(table().filter(x=>x.type==='VHF').length===0,'and the rows the tombstones name are gone');

/* ─────────────────────────────────────────────────────────────────────── */
say('— what the crew sees of a radio row —');
/* the tombstones of the block above would otherwise follow these rows, which carry the same
   ids; both the device's list and the one in the repository have to go */
E('TOMB=[];save(K_TOMB,TOMB)');delete FILES['data/GB-2026-07.deleted.json'];
const mixed=[crew(1,'ATC'),crew(2,'POS'),vhf(1),vhf(2,'Tx 6.2 sec'),vhf(3),crew(3,'Ballast')];
put('data/GB-2026-07.json',JSON.stringify(mixed,null,1));
E('ENT='+JSON.stringify(mixed.map(x=>Object.assign({},x,{synced:true})))+';save(K_ENT,ENT)');
E('UI.logF="";save(K_UI,UI)');E('paintLog()');await sleep(200);
const logHtml=()=>d.getElementById('logList').textContent.replace(/\s+/g,' ');
ok(/VHF/.test(logHtml()),'the log marks them as VHF');
ok(/FRQ 127.800 ZURICH F active/.test(logHtml()),'and prints what the radio app wrote');
ok(/Tx 6.2 sec/.test(logHtml()),'including the short ones');
ok(/127\.800 · ZURICH F|Tx · 127\.800/.test(logHtml()),
   'a row whose note does not carry the frequency gets it added');
ok(d.querySelectorAll('#logList .entry').length===6,'six rows, got '+d.querySelectorAll('#logList .entry').length);

say('— and the filter —');
const chips=()=>[...d.querySelectorAll('#logFilter button')].map(b=>b.dataset.k+'|'+b.textContent.trim());
ok(chips().some(c=>c.startsWith('VHF|')),'there is a chip for VHF alone: '+chips().join(', '));
ok(chips().some(c=>c.startsWith('-VHF|')),'and one that leaves VHF out');
d.querySelector('#logFilter [data-k="-VHF"]').click();await sleep(200);
ok(d.querySelectorAll('#logList .entry').length===3,
   'without VHF, three rows, got '+d.querySelectorAll('#logList .entry').length);
ok(!/VHF/.test(logHtml()),'and none of them is one');
d.querySelector('#logFilter [data-k="VHF"]').click();await sleep(200);
ok(d.querySelectorAll('#logList .entry').length===3,'VHF alone, three rows');
d.querySelector('#logFilter [data-k=""]').click();await sleep(200);
ok(d.querySelectorAll('#logList .entry').length===6,'and all six again');
ok(E('UI.logF')==='','the default shows everything');

say('— a radio row is readable and removable, not rewritable —');
E('editEntry')('k1');await sleep(400);
ok(/krt2/.test(txt()),'the window names who wrote it: '+txt().slice(0,80));
ok(!m().querySelector('[data-k]'),'and offers no field to change');
ok(!!m().querySelector('#mDel'),'but still offers to delete it');
await close();

say('— the exports carry them —');
const kml=E('toKml')(E('chrono(ENT)'));
ok(/<Folder><name>VHF \(3\)/.test(kml),'KML gives VHF a folder of its own');
ok(/<Style id="sVHF">/.test(kml),'with a style, so Earth does not point at one that is missing');
ok((kml.match(/<styleUrl>#sVHF<\/styleUrl>/g)||[]).length===3,'and three placemarks use it');
ok(/FRQ 127.800 ZURICH F active/.test(kml),'the note travels with them');
const gj=JSON.parse(E('toGeoJson')(E('chrono(ENT)')));
ok(gj.features.filter(f=>f.properties&&f.properties.type==='VHF').length===3,
   'GeoJSON keeps all three');
ok(gj.features.filter(f=>f.properties&&f.properties.type==='VHF')
    .every(f=>f.geometry&&f.geometry.coordinates.length===3),'each with its height');
const csv=E('toCsv')(E('chrono(ENT)'));
ok(csv.split('\n').filter(l=>/,VHF,/.test(l)).length===3,'and the CSV has them too');

say('— the sums leave them alone —');
const bal=E('recalc(ENT)');
ok(typeof bal==='number'&&isFinite(bal),'ballast still adds up: '+bal+' kg');
ok(E("ENT.filter(e=>e.type==='VHF').every(e=>e.ballast_abs_kg==null)"),
   'and nothing was written onto a radio row');

say('— the archive —');
E('ENT=[];save(K_ENT,ENT)');
const arch=await E('archiveRows')({flight:'GB-2026-07',json:'data/GB-2026-07.json'});
ok(arch.rows.length===6,'the archive reads the flight back, got '+arch.rows.length);
ok(arch.rows.filter(r=>r.type==='VHF').length===3,'with its radio rows');
put('data/GB-2026-07.json',JSON.stringify(big,null,1));
const arch2=await E('archiveRows')({flight:'GB-2026-07',json:'data/GB-2026-07.json'});
ok(arch2.rows.length===2600,'and a flight past a megabyte comes back whole, got '+arch2.rows.length);

say('— the answer that refuses the file outright —');
FAIL='forbid';E('for(const k in ETAG)delete ETAG[k]');
const g2=await E('ghGet')('data/GB-2026-07.json');
ok(JSON.parse(g2.text).length===2600,'the body is still had as raw, got '+(g2.text?JSON.parse(g2.text).length:0));
ok(!!g2.sha,'and the sha comes from the folder listing, so a write can still name it');
FAIL=null;

say('— dictionaries —');
const en=Object.keys(E('L.en')),de=Object.keys(E('L.de'));
const miss=en.filter(k=>!de.includes(k)).concat(de.filter(k=>!en.includes(k)));
ok(miss.length===0,'aligned'+(miss.length?': '+miss.join(','):''));
S('lang','de');E('applyLang')();
ok(E("t('logNoVhf')")==='ohne VHF','German reaches the new text');
S('lang','en');E('applyLang')();

say(bad?bad+' FAILED':'all passed');
process.exit(0);
})().catch(e=>{say('THREW '+(e&&e.stack||e));process.exit(1)});
