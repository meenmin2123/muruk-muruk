// 작심 ↔ Notion 중계 서버 (의존성 0, Node 18+ 내장 fetch 사용)
// 실행:  NOTION_TOKEN=ntn_xxx node notion-sync-server.mjs
// 앱은 이 서버에만 요청하고, 서버가 토큰을 들고 Notion API를 호출합니다.

import http from 'node:http';
import fs from 'node:fs';
import crypto from 'node:crypto';

// 같은 폴더의 .env 자동 로드 (의존성 없이) — KEY=VALUE 한 줄씩
try{
  const env=fs.readFileSync(new URL('./.env',import.meta.url),'utf8');
  for(const line of env.split('\n')){
    const m=line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
    if(m && !process.env[m[1]]) process.env[m[1]]=m[2].replace(/^["']|["']$/g,'').trim();
  }
}catch{}

const TOKEN   = process.env.NOTION_TOKEN;                 // 필수: 내 노션 인테그레이션 비밀키
const DREAM_DS= process.env.DREAM_DS || 'a88b9e89-2dbc-4e42-ad0c-1594636a003a'; // 작심·목표
const TODO_DS = process.env.TODO_DS  || 'da4f4b25-a21a-46d9-9ede-9a8ad0be6eaa'; // 작심·할일
const PORT    = process.env.PORT || 8787;
const NV      = '2025-09-03'; // Notion API 버전 (데이터소스 지원)
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ''; // 설정 시 구글 로그인 필수 + 사용자별 분리
const USER_PROP        = process.env.USER_PROP || '사용자';  // 노션 두 DB에 추가할 텍스트 속성 이름

if(!TOKEN){ console.error('❌ NOTION_TOKEN 환경변수가 필요해요. 예) NOTION_TOKEN=ntn_xxx node notion-sync-server.mjs'); process.exit(1); }
if(!GOOGLE_CLIENT_ID){ console.warn('⚠️  GOOGLE_CLIENT_ID 미설정 — 로그인 검증 없이 단일 사용자 모드로 동작합니다.'); }

// ---- 구글 ID 토큰 검증 (의존성 0, node:crypto + JWKS) ----
let _certs={keys:{},exp:0};
async function googleCerts(){
  if(_certs.exp>Date.now()) return _certs.keys;
  const r=await fetch('https://www.googleapis.com/oauth2/v3/certs');
  const j=await r.json();
  const keys={}; for(const k of (j.keys||[])) keys[k.kid]=k;
  let ttl=3600; const cc=r.headers.get('cache-control'); const m=cc&&cc.match(/max-age=(\d+)/); if(m) ttl=+m[1];
  _certs={keys, exp:Date.now()+ttl*1000};
  return keys;
}
const b64urlJson=s=>JSON.parse(Buffer.from(s,'base64url').toString('utf8'));
async function verifyGoogle(idToken){
  const [h,p,s]=String(idToken||'').split('.');
  if(!h||!p||!s) throw new Error('잘못된 토큰');
  const header=b64urlJson(h);
  const jwk=(await googleCerts())[header.kid];
  if(!jwk) throw new Error('알 수 없는 서명 키');
  const pub=crypto.createPublicKey({key:jwk,format:'jwk'});
  if(!crypto.verify('RSA-SHA256', Buffer.from(h+'.'+p), pub, Buffer.from(s,'base64url'))) throw new Error('서명 검증 실패');
  const payload=b64urlJson(p);
  if(payload.iss!=='accounts.google.com' && payload.iss!=='https://accounts.google.com') throw new Error('발급자 불일치');
  if(GOOGLE_CLIENT_ID && payload.aud!==GOOGLE_CLIENT_ID) throw new Error('대상(aud) 불일치');
  if((payload.exp||0)*1000 < Date.now()) throw new Error('만료된 토큰');
  return payload; // { sub, email, name, ... }
}
// 요청에서 사용자 식별 → sub 반환(없으면 단일 사용자 모드에선 null)
async function authUser(req){
  const m=String(req.headers['authorization']||'').match(/^Bearer\s+(.+)$/i);
  if(!GOOGLE_CLIENT_ID){
    if(m){ try{ return (await verifyGoogle(m[1])).sub; }catch{} }
    return null; // 단일 사용자 모드
  }
  if(!m) throw Object.assign(new Error('로그인이 필요해요'),{code:401});
  try{ return (await verifyGoogle(m[1])).sub; }
  catch(e){ throw Object.assign(new Error('인증 실패: '+e.message),{code:401}); }
}

// 앱 카테고리 키 ↔ 노션 "분류" 라벨
const CAT2LABEL={travel:'여행',study:'공부',cert:'자격증',job:'취업',career:'이직',health:'건강',happy:'소소한 행복'};
const LABEL2CAT=Object.fromEntries(Object.entries(CAT2LABEL).map(([k,v])=>[v,k]));
const CAT_EMOJI={travel:'✈️',study:'📚',cert:'📜',job:'💼',career:'🔄',health:'💪',happy:'🌷',free:'🎯'};

const api=async (path,method,body)=>{
  const r=await fetch('https://api.notion.com/v1'+path,{
    method,
    headers:{'Authorization':'Bearer '+TOKEN,'Notion-Version':NV,'Content-Type':'application/json'},
    body:body?JSON.stringify(body):undefined
  });
  const j=await r.json();
  if(!r.ok) throw new Error('Notion '+r.status+': '+JSON.stringify(j));
  return j;
};

// ---- 노션 속성 빌더/리더 ----
const pTitle =v=>({title:[{text:{content:String(v||'')}}]});
const pText  =v=>({rich_text:v?[{text:{content:String(v)}}]:[]});
const pSelect=v=>v?({select:{name:v}}):{select:null};
const pDate  =v=>v?({date:{start:v}}):{date:null};
const pCheck =v=>({checkbox:!!v});
const pNum   =v=>({number:(v??null)});
const pRel   =id=>({relation:id?[{id}]:[]});

const rTitle =p=>(p?.title||[]).map(t=>t.plain_text).join('');
const rText  =p=>(p?.rich_text||[]).map(t=>t.plain_text).join('');
const rSelect=p=>p?.select?.name||null;
const rDate  =p=>p?.date?.start||null;
const rCheck =p=>!!p?.checkbox;
const rNum   =p=>(typeof p?.number==='number'?p.number:0);
const rRel   =p=>(p?.relation||[]).map(x=>x.id);

const createPage=(ds,props,icon)=>api('/pages','POST',{parent:{type:'data_source_id',data_source_id:ds},properties:props,...(icon?{icon:{type:'emoji',emoji:icon}}:{})});
const updatePage=(id,props)=>api('/pages/'+id,'PATCH',{properties:props});
const archivePage=id=>api('/pages/'+id,'PATCH',{archived:true});

const queryAll=async (ds,filter)=>{
  let out=[],cursor=undefined;
  do{
    const j=await api('/data_sources/'+ds+'/query','POST',{page_size:100,...(filter?{filter}:{}),...(cursor?{start_cursor:cursor}:{})});
    out=out.concat(j.results||[]);
    cursor=j.has_more?j.next_cursor:undefined;
  }while(cursor);
  return out;
};
// 사용자별 필터: 노션 "사용자" 텍스트 속성 == 구글 sub
const userFilter=u=>u?({property:USER_PROP, rich_text:{equals:u}}):undefined;

// ---- PUSH: 앱 → 노션 ----
async function push({dreams=[],todos=[]}, user){
  const goalById={}, goalToDream={};
  dreams.forEach(d=>(d.goals||[]).forEach(g=>{goalById[g.id]=g; goalToDream[g.id]=d.id;}));

  const dreamIds={}; // appId -> notion pageId
  for(const d of dreams){
    const allGold=(d.goals||[]).length>0 && d.goals.every(g=>g.goldEarned);
    const props={
      '목표':pTitle(d.title),
      'D-Day':pDate(d.targetDate),
      '상태':pSelect(allGold?'달성':'진행 중'),
      '메모':pText(d.color||'')
    };
    if(user) props[USER_PROP]=pText(user);
    if(CAT2LABEL[d.cat]) props['분류']=pSelect(CAT2LABEL[d.cat]);
    let pageId=d.notionId;
    if(pageId){ await updatePage(pageId,props); }
    else { const pg=await createPage(DREAM_DS,props,d.emoji||CAT_EMOJI[d.cat]||'🎯'); pageId=pg.id; }
    dreamIds[d.id]=pageId;
  }

  const todoIds={};
  for(const t of todos){
    const g=t.goalId?goalById[t.goalId]:null;
    const dreamPage=t.goalId?dreamIds[goalToDream[t.goalId]]:null;
    const props={
      '할 일':pTitle(t.text),
      '날짜':pDate(t.date),
      '완료':pCheck(t.done),
      '반복':pSelect(g&&g.repeat==='daily'?'매일':'한 번'),
      '세부목표':pText(g?g.title:''),
      '칭찬스티커':pNum(g?(g.stickers||[]).length:0),
      '달성도장':pCheck(g?!!g.goldEarned:false),
      '목표':pRel(dreamPage||null)
    };
    if(user) props[USER_PROP]=pText(user);
    let pageId=t.notionId;
    if(pageId){ await updatePage(pageId,props); }
    else { const pg=await createPage(TODO_DS,props); pageId=pg.id; }
    todoIds[t.id]=pageId;
  }

  // 삭제 동기화(조정): push는 전체 상태를 보내므로, 이번에 없는 이 사용자의
  // 노션 페이지는 보관(archive) 처리해 앱의 삭제를 노션에도 반영.
  const keepDreams=new Set(Object.values(dreamIds));
  const keepTodos=new Set(Object.values(todoIds));
  let archived=0;
  const [exDreams,exTodos]=await Promise.all([queryAll(DREAM_DS,userFilter(user)),queryAll(TODO_DS,userFilter(user))]);
  for(const row of exTodos){ if(!keepTodos.has(row.id)){ await archivePage(row.id); archived++; } }
  for(const row of exDreams){ if(!keepDreams.has(row.id)){ await archivePage(row.id); archived++; } }

  return {dreamIds,todoIds,pushed:{dreams:dreams.length,todos:todos.length},archived};
}

// ---- PULL: 노션 → 앱 ----
const uid=()=>Math.random().toString(36).slice(2,9);
async function pull(user){
  const f=userFilter(user);
  const [dreamRows,todoRows]=await Promise.all([queryAll(DREAM_DS,f),queryAll(TODO_DS,f)]);
  const pageToDream={}; const dreams=[];
  for(const row of dreamRows){
    const P=row.properties;
    const cat=LABEL2CAT[rSelect(P['분류'])]||'free';
    const memo=rText(P['메모']);
    const d={id:uid(),notionId:row.id,title:rTitle(P['목표'])||'(제목 없음)',
      emoji:(row.icon&&row.icon.emoji)||CAT_EMOJI[cat]||'🎯',cat,
      color:/^#?[0-9a-fA-F]{6}$/.test(memo)?(memo[0]==='#'?memo:'#'+memo):'#FF7A59',
      targetDate:rDate(P['D-Day']),goals:[]};
    dreams.push(d); pageToDream[row.id]=d;
  }
  const todos=[];
  for(const row of todoRows){
    const P=row.properties;
    const dreamPage=rRel(P['목표'])[0];
    const d=dreamPage?pageToDream[dreamPage]:null;
    const goalTitle=rText(P['세부목표']);
    let goalId=null;
    if(d&&goalTitle){
      let g=d.goals.find(x=>x.title===goalTitle);
      if(!g){
        const cnt=rNum(P['칭찬스티커']);
        g={id:uid(),title:goalTitle,repeat:(rSelect(P['반복'])==='매일'?'daily':'once'),
           stickers:Array.from({length:cnt},()=>'⭐'),goldEarned:rCheck(P['달성도장'])};
        d.goals.push(g);
      }
      goalId=g.id;
    }
    todos.push({id:uid(),notionId:row.id,text:rTitle(P['할 일']),date:rDate(P['날짜'])||new Date().toISOString().slice(0,10),
      done:rCheck(P['완료']),goalId});
  }
  return {dreams,todos};
}

// ---- HTTP 서버 (CORS 포함) ----
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization'};
const send=(res,code,obj)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8',...cors}); res.end(JSON.stringify(obj));};

http.createServer(async (req,res)=>{
  if(req.method==='OPTIONS'){ res.writeHead(204,cors); return res.end(); }
  const url=new URL(req.url,'http://x');
  try{
    if(req.method==='GET' && url.pathname==='/')    return send(res,200,{ok:true,service:'jaksim-notion-sync',auth:!!GOOGLE_CLIENT_ID});
    if(req.method==='GET' && url.pathname==='/pull'){
      const user=await authUser(req);
      return send(res,200,await pull(user));
    }
    if(req.method==='POST'&& url.pathname==='/push'){
      const user=await authUser(req);
      let buf=''; for await (const c of req) buf+=c;
      const body=buf?JSON.parse(buf):{};
      return send(res,200,await push(body,user));
    }
    send(res,404,{error:'not found'});
  }catch(e){ console.error(e); send(res,e.code===401?401:500,{error:String(e.message||e)}); }
}).listen(PORT,()=>console.log(`✅ 작심 동기화 서버 실행: http://localhost:${PORT}  (push/pull 준비됨${GOOGLE_CLIENT_ID?' · 구글 로그인 ON':''})`));
