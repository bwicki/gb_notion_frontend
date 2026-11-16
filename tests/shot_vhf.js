/* Four pictures: the log with radio rows among the crew's, the filter with VHF put aside,
   the window a radio row opens, and the flight in the archive. */
const {chromium}=require('playwright');
const iso=(h,m)=>'2026-11-16T'+String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':00.000Z';
const ROWS=[
 {id:'a1',flight_id:'GB-2026-07',callsign:'HB-QXY',seq:1,reporter:'Balthasar',source:'basket',
  ts_utc:iso(6,2),ts_local:iso(7,2),type:'Ballast',ballast_action:'count',inv_bags:18,water_kg:40,
  inv_ready_pct:100,sand_kg:270,total_ballast_kg:310,ballast_abs_kg:310,sand_left_kg:270,water_left_kg:40,
  lat:47.21,lon:8.33,alt_ft:1200,alt_gps_m:366},
 {id:'k1',flight_id:'GB-2026-07',callsign:'HB-QXY',seq:5001,reporter:'KRT2',source:'krt2',
  ts_utc:iso(6,14),ts_local:iso(7,14),type:'VHF',atc_dir:'TX',atc_freq:'127.800',
  atc_station:'ZURICH F',note:'FRQ 127.800 ZURICH F active',lat:47.3,lon:8.4,alt_ft:2400,alt_gps_m:732},
 {id:'a2',flight_id:'GB-2026-07',callsign:'HB-QXY',seq:2,reporter:'Balthasar',source:'basket',
  ts_utc:iso(6,21),ts_local:iso(7,21),type:'ATC',atc_dir:'TX',atc_station:'ZURICH INFO',
  atc_freq:'127.800',atc_msg:'HB-QXY, gas balloon, FL 075, ops normal',lat:47.33,lon:8.44,
  alt_ft:7500,alt_gps_m:2286},
 {id:'k2',flight_id:'GB-2026-07',callsign:'HB-QXY',seq:5002,reporter:'KRT2',source:'krt2',
  ts_utc:iso(6,22),ts_local:iso(7,22),type:'VHF',atc_dir:'TX',atc_freq:'127.800',
  atc_station:'ZURICH F',note:'Tx 6.2 sec',lat:47.34,lon:8.45,alt_ft:7520,alt_gps_m:2292},
 {id:'a3',flight_id:'GB-2026-07',callsign:'HB-QXY',seq:3,reporter:'Nicole',source:'basket',
  ts_utc:iso(6,40),ts_local:iso(7,40),type:'POS',lat:47.41,lon:8.52,alt_ft:8100,alt_gps_m:2469,
  vs_ms:-0.3,tc_deg:214,speed_kt:17,place:'near Zug'},
 {id:'k3',flight_id:'GB-2026-07',callsign:'HB-QXY',seq:5003,reporter:'KRT2',source:'krt2',
  ts_utc:iso(6,47),ts_local:iso(7,47),type:'VHF',atc_dir:'TX',atc_freq:'119.225',
  atc_station:'',note:'',lat:47.44,lon:8.55,alt_ft:8200,alt_gps_m:2499},
 {id:'a4',flight_id:'GB-2026-07',callsign:'HB-QXY',seq:4,reporter:'Balthasar',source:'basket',
  ts_utc:iso(7,5),ts_local:iso(8,5),type:'Ballast',ballast_medium:'sand',ballast_delta_kg:-15,
  ballast_abs_kg:295,sand_left_kg:255,water_left_kg:40,lat:47.5,lon:8.6,alt_ft:8600,alt_gps_m:2621},
];
const IDX=[{flight:'GB-2026-07',closed_at:'2026-11-16T12:00:00Z',rows:7,closed_by:'Balthasar',
            json:'data/GB-2026-07.json'},
           {flight:'GB-2026-05',closed_at:'2026-09-12T18:20:00Z',rows:338,closed_by:'Balthasar',
            json:'data/GB-2026-05.json'}];
const DIR=[{type:'file',name:'GB-2026-07.json',path:'data/GB-2026-07.json',sha:'a'.repeat(40)},
           {type:'file',name:'GB-2026-05.json',path:'data/GB-2026-05.json',sha:'b'.repeat(40)},
           {type:'file',name:'_flights.json',path:'data/_flights.json',sha:'c'.repeat(40)}];

(async()=>{
const b=await chromium.launch();
const ctx=await b.newContext({viewport:{width:393,height:852},deviceScaleFactor:2});
const p=await ctx.newPage();
await p.addInitScript(({ROWS,IDX,DIR})=>{
  navigator.geolocation.getCurrentPosition=()=>{};navigator.geolocation.watchPosition=()=>1;
  localStorage.setItem('bsk.dev','DSHOT');
  localStorage.setItem('bsk.cfg.v6',JSON.stringify({repo:'bwicki/gb_flight_data',token:'W',
    dir:'data',branch:'main',role:'master',flight:'GB-2026-07',call:'HB-QXY',lang:'en',
    reporter:'Balthasar',p1:'Balthasar',p2:'Nicole',mode:'shared',provisioned:1,init:310}));
  localStorage.setItem('bsk.entries.v6',JSON.stringify(ROWS.map(r=>({...r,synced:true}))));
  const b64=o=>btoa(unescape(encodeURIComponent(JSON.stringify(o))));
  window.fetch=(u,o)=>{u=String(u);o=o||{};
    const ok=x=>Promise.resolve({ok:true,status:200,headers:{get:()=>null},json:()=>Promise.resolve(x)});
    if(/contents\/data\?/.test(u))return ok(DIR);
    if(/_flights\.json/.test(u))return ok({sha:'c',size:99,encoding:'base64',content:b64(IDX)});
    if(/GB-2026-07\.json/.test(u))return ok({sha:'a',size:999,encoding:'base64',content:b64(ROWS)});
    if(/GB-2026-05\.json/.test(u))return ok({sha:'b',size:999,encoding:'base64',content:b64(ROWS)});
    return Promise.resolve({ok:false,status:404,headers:{get:()=>null},json:()=>Promise.resolve({})});
  };
},{ROWS,IDX,DIR});
await p.goto('file:///home/claude/gb_notion_frontend/index.html');
await p.waitForTimeout(900);

/* the log, everything shown */
await p.evaluate(()=>{UI.logF='';save(K_UI,UI);setView('log');paintLog()});
await p.waitForTimeout(500);
await p.screenshot({path:'/home/claude/v1-log.png'});

/* the same log with the radio rows put aside */
await p.evaluate(()=>{document.querySelector('#logFilter [data-k="-VHF"]').click()});
await p.waitForTimeout(400);
await p.screenshot({path:'/home/claude/v2-filter.png'});

/* what one of those rows opens */
await p.evaluate(()=>{UI.logF='';save(K_UI,UI);paintLogFilter();paintLog();editEntry('k1')});
await p.waitForTimeout(700);
await p.locator('#modal .sheet').screenshot({path:'/home/claude/v3-row.png'});
await p.evaluate(()=>{const b=document.querySelector('#modal [data-a="1"]');if(b)b.click()});
await p.waitForTimeout(400);

/* the flight in the archive */
await p.evaluate(async()=>{const l=await archiveList();openFlight(l.find(x=>x.flight==='GB-2026-07'))});
await p.waitForTimeout(1500);
await p.locator('#modal .sheet').screenshot({path:'/home/claude/v4-archive.png'});
console.log('shots ok');
await b.close();})();
