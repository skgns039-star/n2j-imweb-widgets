/* No network, credentials, storage, or membership simulation. */
window.__ddak = window.__ddak || {};
window.__ddak.mountN2JReviews=function(root,{items=[],mode='page',urls={},state='success',onRetry,rolling=false}={}){
 root.__ddakReviewsDispose?.();
 const removers=[];let disposed=false;
 const listen=(target,type,fn)=>{target.addEventListener(type,fn);removers.push(()=>target.removeEventListener(type,fn))};
 const dispose=()=>{if(disposed)return;disposed=true;removers.splice(0).forEach(fn=>fn());if(root.__ddakReviewsDispose===dispose)delete root.__ddakReviewsDispose;};
 root.__ddakReviewsDispose=dispose;
 const api={dispose};
 const clean=items.filter(x=>x.verified===true && typeof x.body==='string' && x.body.trim());
 root.replaceChildren();root.classList.add('ddak-n2j-reviews');
 const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n};
 const top=el('div','ddak-rv-top'),heading=el('div');heading.append(el('p','ddak-rv-eyebrow','CLIENT REVIEWS'),el(mode!=='home'?'h1':'h2','',mode!=='home'?'함께 만든 경험':'작업이 끝난 뒤, 남은 이야기'),el('p','ddak-rv-intro','엔투제이트리니와 함께한 제작 경험을 나누는 공간입니다.'));top.append(heading);root.append(top);
 const actions=el('div','ddak-rv-actions');
 for(const [key,label] of (mode==='intro'?[['join','회원가입'],['login','로그인']]:[['all','전체 리뷰'],['write','리뷰 쓰기'],...(mode==='page'?[['join','회원가입'],['login','로그인']]:[])])){const href=urls[key]||({join:'/?mode=join',login:'/?mode=login'})[key];if(href){const a=el('a',key==='write'?'ddak-rv-primary':'',label);a.href=href;actions.append(a)}}top.append(actions);
 if(mode==='intro'){root.setAttribute('aria-busy','false');return api;}
 if(state==='loading'||state==='error'){
 const box=el('div','ddak-rv-empty ddak-rv-state');box.setAttribute('role',state==='error'?'alert':'status');root.setAttribute('aria-busy',String(state==='loading'));
 box.append(el('h3','',state==='loading'?'리뷰를 불러오고 있습니다.':'리뷰를 불러오지 못했습니다.'),el('p','ddak-rv-muted',state==='loading'?'잠시만 기다려 주세요.':'잠시 후 다시 시도해 주세요.'));
 if(state==='error'&&typeof onRetry==='function'){const retry=el('button','ddak-rv-retry','다시 시도');retry.type='button';listen(retry,'click',onRetry);box.append(retry)}root.append(box);return api;
 }
 root.setAttribute('aria-busy','false');
 if(mode==='home'&&state==='success'){const bg=el('canvas','ddak-rv-bg');bg.setAttribute('aria-hidden','true');root.append(bg);const field=window.__ddak.reviewField?.(bg,{host:root});if(field){root.__ddakReviewField=field;removers.push(()=>{field.dispose();if(root.__ddakReviewField===field)delete root.__ddakReviewField})}}
 if(!clean.length){const empty=el('div','ddak-rv-empty');empty.append(el('h3','','아직 공개된 리뷰가 없습니다.'),el('p','ddak-rv-muted','함께한 경험을 첫 리뷰로 남겨주세요.'));root.append(empty)}
 const card=(x,full)=>{const a=el('article','ddak-rv-card');a.append(el('p','ddak-rv-meta',x.displayName||'작성자 비공개'));if(full&&x.body.length>200){a.append(el('p','',x.body.slice(0,200)+'…'));const d=el('details'),s=el('summary','','리뷰 전문 읽기');d.append(s,el('p','',x.body));a.append(d)}else a.append(el('p','',full?x.body:(x.body.length>200?x.body.slice(0,200)+'…':x.body)));return a};
 if(clean.length){if(mode!=='home'||clean.length<4||typeof window.__ddak.flowEngine!=='function'){const list=el('div','ddak-rv-list');list.setAttribute('role','list');clean.forEach(x=>{const item=card(x,true);item.setAttribute('role','listitem');list.append(item)});root.append(list)}else{
 // 0.1.6 (owner choice 1, 2026-11-09): 4+ public reviews flow as a draggable grid (8+ = two rows in opposite directions); 1-3 stay the static cards above
 const wrap=el('div','ddak-rv-flow'),bar=el('div','ddak-rv-fbar'),ctl=el('div','ddak-rv-fctl');
 const nav=(d,label,t)=>{const b=el('button','ddak-rv-nav',t);b.type='button';b.dataset.dir=d;b.setAttribute('aria-label',label);return b};
 const prev=nav('-1','이전 리뷰','←'),next=nav('1','다음 리뷰','→'),pause=el('button','ddak-rv-pause','흐름 정지');pause.type='button';pause.setAttribute('aria-pressed','false');ctl.append(prev,next,pause);
 bar.append(el('p','ddak-rv-fhint',matchMedia('(hover: hover) and (pointer: fine)').matches?'끌어서 넘겨 보세요. 마우스를 올리면 흐름이 멈춥니다.':'옆으로 밀어서 넘겨 보세요.'),ctl);
 const stage=el('div','ddak-rv-stage');stage.setAttribute('role','region');stage.setAttribute('aria-label','고객 리뷰 '+clean.length+'건');
 const n=clean.length>=8?2:1,rows=[];
 for(let r=0;r<n;r++){const row=el('div','ddak-rv-row'),track=el('div','ddak-rv-ftrack'),group=el('div','ddak-rv-fgroup');group.setAttribute('role','list');clean.slice(r*Math.ceil(clean.length/n),(r+1)*Math.ceil(clean.length/n)).forEach(x=>{const c=card(x,false);c.setAttribute('role','listitem');group.append(c)});track.append(group);row.append(track);stage.append(row);rows.push({row,track,group,dir:r?-1:1,ratio:1})}
 wrap.append(bar,stage);root.append(wrap);
 const flow=window.__ddak.flowEngine({host:wrap,stage,rows,pauseBtn:pause,navs:[prev,next],section:root,cardSel:'.ddak-rv-card',speed:()=>innerWidth<768?18:28});
 root.__ddakReviewFlow=flow;removers.push(()=>{flow.dispose();if(root.__ddakReviewFlow===flow)delete root.__ddakReviewFlow});
 }}
 root.append(el('p','ddak-rv-muted','리뷰 작성은 회원가입·로그인 후 이용할 수 있습니다.'));
 return api;
};

/* 0.1.5 review background field (sian jobs/n2jtrini_motion_20261109 bg-field.js shape 'threads').
   Same dots as the home canvas#bg (1.6px, olive .30, lerp .055). Ambient 3.2s then rests (WCAG 2.2.2);
   fine pointer wakes it 1.6s; off-screen/hidden tab paused; reduced motion = one still frame. rAF instead of anime.js timer. */
(function(){
'use strict';window.__ddak=window.__ddak||{};
const hash=(i,s)=>{const v=Math.sin(i*s)*43758.5453;return v-Math.floor(v)};
function threads(i,n,t,w,h){const lines=w>900?9:6,line=i%lines,per=Math.ceil(n/lines),k=Math.floor(i/lines)/per,drift=(t*0.018*(1+line*0.07))%1;let u=k-drift;u-=Math.floor(u);
 const x=u*(w+80)-40,base=h*(0.16+0.68*(line/(lines-1))),amp=h*0.035*(1+Math.sin(t*0.35+line)*0.35);
 return{x,y:base+Math.sin(u*Math.PI*2*1.5+t*0.6+line*0.9)*amp+Math.sin(u*Math.PI*2*4-t*0.9)*amp*0.18}}
const AMBIENT_MS=3200,WAKE_MS=1600,EASE_OUT_MS=900,HARD_STOP_MS=600;
window.__ddak.reviewField=function(canvas,{host=canvas.parentElement,color='rgba(121,134,69,0.30)',density=1}={}){
 const ctx=canvas.getContext&&canvas.getContext('2d');if(!ctx||!('IntersectionObserver' in window)||!('ResizeObserver' in window))return null;
 const reduceMQ=matchMedia('(prefers-reduced-motion: reduce)'),fineMQ=matchMedia('(hover: hover) and (pointer: fine)');
 let w=0,h=0,dpr=1,pts=[],visible=false,simT=0,last=0,until=0,settled=false,firstFrame=0,settledAt=0,moved=0,raf=0,disposed=false;
 const ptr={x:-9999,y:-9999,on:false};
 function draw(t,snap=false,k=0.055){ctx.clearRect(0,0,w,h);ctx.fillStyle=color;const n=pts.length,R=120,R2=R*R;moved=0;
  for(let i=0;i<n;i++){const p=pts[i],g=threads(i,n,t,w,h);let tx=g.x+(hash(i,3.7)-0.5)*6,ty=g.y+(hash(i,9.1)-0.5)*6;
   if(ptr.on){const dx=tx-ptr.x,dy=ty-ptr.y,d2=dx*dx+dy*dy;if(d2<R2){const f=(1-Math.sqrt(d2)/R)*22,d=Math.sqrt(d2)||1;tx+=dx/d*f;ty+=dy/d*f}}
   if(!snap&&Math.abs(tx-p.x)>w*0.5){p.x=tx;p.y=ty}
   if(snap){p.x=tx;p.y=ty}else{const dx=(tx-p.x)*k,dy=(ty-p.y)*k;p.x+=dx;p.y+=dy;moved=Math.max(moved,Math.abs(dx),Math.abs(dy))}
   ctx.fillRect(p.x,p.y,1.6,1.6)}}
 function rebuild(){if(disposed)return;dpr=Math.min(devicePixelRatio||1,2);const r=host.getBoundingClientRect();w=Math.max(1,Math.round(r.width));h=Math.max(1,Math.round(r.height));
  canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
  const n=Math.round((w>900?1500:640)*density),prev=pts;pts=Array.from({length:n},(_,i)=>prev[i]??{x:hash(i,12.9898)*w,y:hash(i,78.233)*h});
  if(reduceMQ.matches||(settled&&!raf))draw(simT,true)}
 const pause=()=>{if(raf)cancelAnimationFrame(raf);raf=0;last=0};
 function frame(){raf=requestAnimationFrame(frame);const now=performance.now();if(!firstFrame)firstFrame=now;const dt=last?Math.min(now-last,64):16;last=now;
  const tempo=Math.max(0,Math.min(1,(until-now)/EASE_OUT_MS));simT+=(dt/1000)*tempo;draw(simT,false,0.055+(1-tempo)*0.125);
  const hard=now>until+HARD_STOP_MS;if(hard&&moved>=0.1)draw(simT,true);
  if(tempo===0&&(moved<0.1||hard)){settled=true;if(!settledAt)settledAt=now;pause()}}
 const wake=(ms)=>{if(disposed||reduceMQ.matches||!visible||document.hidden)return;until=Math.max(until,performance.now()+ms);settled=false;if(!raf)raf=requestAnimationFrame(frame)};
 const sync=()=>{if(visible&&!document.hidden&&!reduceMQ.matches)wake(AMBIENT_MS);else pause()};
 const io=new IntersectionObserver(es=>{const v=es.some(e=>e.isIntersecting),entered=v&&!visible;visible=v;if(entered||!v)sync()},{threshold:0});io.observe(host);
 const onVis=()=>{if(document.hidden)pause();else sync()},onMQ=()=>{rebuild();sync()};
 document.addEventListener('visibilitychange',onVis);reduceMQ.addEventListener?.('change',onMQ);
 const ro=new ResizeObserver(()=>rebuild());ro.observe(host);
 const onMove=e=>{const r=canvas.getBoundingClientRect();ptr.x=e.clientX-r.left;ptr.y=e.clientY-r.top;ptr.on=true;wake(WAKE_MS)},onLeave=()=>{ptr.on=false;wake(WAKE_MS)};
 if(fineMQ.matches){host.addEventListener('pointermove',onMove);host.addEventListener('pointerleave',onLeave)}
 rebuild();
 return{get running(){return !!raf},get settled(){return settled},get count(){return pts.length},get debug(){return{simT,moved,firstSettleMs:settledAt?Math.round(settledAt-firstFrame):null}},
  dispose(){if(disposed)return;disposed=true;pause();io.disconnect();ro.disconnect();document.removeEventListener('visibilitychange',onVis);reduceMQ.removeEventListener?.('change',onMQ);host.removeEventListener('pointermove',onMove);host.removeEventListener('pointerleave',onLeave)}};
};
})();

/* Anonymous public native HTML projection. No authentication or moderation claims. */
(function () {
  'use strict';
  window.__ddak = window.__ddak || {};
  const widget = 'w20261104b7a91a4a18f0d';
  const board = 'b20261104dccbf249f2535';
  const qa = /기능\s*점검|고객\s*후기\s*아님/;
  const pii = /[\w.%+-]+@[\w.-]+\.[a-z]{2,}|(?:\+82[- .]?)?0?1[016789][- .]?\d{3,4}[- .]?\d{4}|\d{6}[- ]?[1-4]\d{6}|(?:계좌|주민등록|연락처|주소)\s*[:：]/i;
  const locked = root => [...root.querySelectorAll('.bt-lock,.icon-lock,.lock')]
    .some(n => !n.closest('[hidden]') && ![n, ...ancestors(n, root)].some(x => x.style.display === 'none' || x.style.visibility === 'hidden'));
  function ancestors(node, root) {
    const result = [];
    for (let p = node.parentElement; p; p = p.parentElement) { result.push(p); if (p === root) break; }
    return result;
  }
  // 0.1.6 (대표님 2026-11-09 21:15 "고** 이렇게해줘"): 작성자 = 성 + 나머지 글자 수만큼 가림 (고서영→고**, 김수→김*, 남궁민수→남***). 가림 글자는 이 한 곳만 바꾼다(예: 'x').
  const MASK = '*';
  const hidden = c => c === '*' || c === MASK;
  function maskName(value) {
    if (typeof value !== 'string') return '';
    const chars = Array.from(value.normalize('NFC').replace(/[\u0000-\u001F\u007F​-‍⁠﻿]/g, '').replace(/\s+/g, ''));
    // 한 글자는 가려도 전체가 드러나므로 표시하지 않는다(작성자 비공개).
    if (chars.length < 2 || chars.length > 40 || hidden(chars[0])) return '';
    return chars[0] + MASK.repeat(chars.length - 1);
  }
  // authors.json = {"authors":{"<게시글 idx>":"고**"}}. 가린 값만 담지만, 위젯이 한 번 더 가려 전체 이름이 실수로 들어가도 화면에 나오지 않는다.
  async function authors(url, signal) {
    if (!url) return {};
    try {
      const response = await fetch(url, {method:'GET', credentials:'omit', redirect:'error', cache:'no-cache',
        signal, headers:{Accept:'application/json'}});
      if (!response.ok) return {};
      const raw = await response.text();
      if (raw.length > 65536) return {};
      const map = JSON.parse(raw)?.authors;
      if (!map || typeof map !== 'object' || Array.isArray(map)) return {};
      const out = Object.create(null);
      for (const [id, name] of Object.entries(map)) {
        const masked = /^[1-9]\d*$/.test(id) ? maskName(name) : '';
        if (masked) out[id] = masked;
      }
      return out;
    } catch (_) { return {}; }
  }
  const text = n => {
    const copy = n.cloneNode(true);
    copy.querySelectorAll('script,style,iframe,object,template').forEach(x => x.remove());
    return copy.textContent.trim();
  };
  function detailURL(href, base) {
    const u = new URL(href, base);
    if (u.origin !== base.origin || !/^\/27\/?$/.test(u.pathname) ||
        u.username || u.password || u.hash || u.searchParams.getAll('idx').length !== 1 ||
        !/^[1-9]\d*$/.test(u.searchParams.get('idx') || '') ||
        u.searchParams.getAll('bmode').length !== 1 || u.searchParams.get('bmode') !== 'view' ||
        (u.searchParams.has('board') && u.searchParams.get('board') !== board) ||
        [...u.searchParams.keys()].some(k => !['idx','bmode','board','t','q','page'].includes(k))) {
      throw new Error('UNSAFE_NATIVE_DETAIL');
    }
    return u;
  }
  async function load({signal, timeoutMs = 5000, authorsURL} = {}) {
    const base = new URL('/27', window.location.origin);
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, {once:true});
    if (signal?.aborted) abort();
    const timer = setTimeout(abort, timeoutMs);
    async function get(url) {
      const response = await fetch(url.href, {method:'GET', credentials:'omit', redirect:'error',
        cache:'no-store', signal:controller.signal, headers:{Accept:'text/html'}});
      if (!response.ok || !/text\/html/i.test(response.headers.get('content-type') || '')) throw new Error('NATIVE_READ_ERROR');
      const html = await response.text();
      if (html.length > 2000000) throw new Error('NATIVE_TOO_LARGE');
      return new DOMParser().parseFromString(html, 'text/html');
    }
    try {
      const names = authors(authorsURL, controller.signal);
      const doc = await get(base);
      const anchor = doc.getElementById(widget) || doc.getElementById('scroll_' + widget);
      if (!anchor) throw new Error('NATIVE_WIDGET_MISSING');
      const scope = doc.getElementById(widget) || anchor.closest('._widget_data');
      if (!scope) throw new Error('NATIVE_WIDGET_SCOPE_MISSING');
      const rows = [...scope.querySelectorAll('.li_board .li_body')];
      if (rows.length > 120) throw new Error('NATIVE_ROW_LIMIT');
      if (!rows.length && ![...scope.querySelectorAll('.empty_list p')].some(n => text(n) === '게시물이 없습니다.')) {
        throw new Error('NATIVE_LIST_UNAVAILABLE');
      }
      const reviews = [], seen = new Set();
      for (const row of rows) {
        if (locked(row) || qa.test(text(row))) continue;
        const link = row.querySelector('a.list_text_title[href]');
        if (!link) throw new Error('NATIVE_LINK_MISSING');
        const url = detailURL(link.getAttribute('href'), base), id = url.searchParams.get('idx');
        if (id === '175419239' || seen.has(id)) continue;
        seen.add(id);
        const detail = await get(url);
        const title = detail.querySelector('h1.view_tit'), body = detail.querySelector('.board_txt_area.fr-view');
        if (!title || !body) throw new Error('NATIVE_DETAIL_UNAVAILABLE');
        if (locked(title) || qa.test(text(title))) continue;
        const value = text(body);
        const normalized = (text(title) + '\n' + value).normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g,'');
        if (!value || value.length > 12000 || qa.test(value) || pii.test(normalized)) continue;
        reviews.push({id,body:value,verified:true});
      }
      const masked = reviews.length ? await names : {};
      return Object.freeze({state: reviews.length ? 'success' : 'empty',
        reviews:Object.freeze(reviews.map(r => Object.freeze(masked[r.id] ? {...r, displayName:masked[r.id]} : r)))});
    } finally {
      clearTimeout(timer); signal?.removeEventListener('abort', abort);
    }
  }
  window.__ddak.nativeReviews = Object.freeze({load, detailURL, maskName, MASK});
})();

(function(){
'use strict';window.__ddak=window.__ddak||{};
function refresh(){requestAnimationFrame(()=>requestAnimationFrame(()=>{try{window.ScrollTrigger?.refresh();}catch(_){}}));}
function mount({root,mode,renderer,timeoutMs,authorsURL,ready=Promise.resolve()}={}){
 if(!root||!root.matches('[data-ddak-slot="n2j-reviews"]')||!['home','intro'].includes(mode))throw Error('REVIEW_MOUNT_CONTRACT');
 if(['write','view','edit'].includes(new URLSearchParams(location.search).get('bmode'))||root.dataset.ddakReviewBound||root.childNodes.length)return null;
 const anchor=document.getElementById(mode==='home'?'contact':'w20261104b7a91a4a18f0d');if(!anchor)return null;
 anchor.before(root);refresh();root.dataset.ddakReviewBound='true';let running=false,rendered=false;
 const urls={all:'/27',write:'/27?board=b20261104dccbf249f2535&bmode=write',join:'/?mode=join',login:'/?mode=login'};
 function render(state,items=[]){if(typeof renderer!=='function')throw Error('REVIEW_RENDERER_MISSING');renderer(root,{mode,items,urls,state,onRetry:retry,rolling:false});root.dataset.state=state;refresh();}
 async function retry(){if(running||rendered)return;running=true;
 try{render('loading');await(typeof ready==='function'?ready():ready);const result=mode==='intro'?{state:'success',reviews:[]}:await window.__ddak.nativeReviews.load({timeoutMs,authorsURL});render(result.state,result.reviews);rendered=true;}
 catch(_){render('error');}finally{running=false;root.setAttribute('aria-busy','false');}}
 return{done:retry(),retry};
}
window.__ddak.reviewController=Object.freeze({mount,refresh});
})();

(function () {
  'use strict';
  window.__ddak = window.__ddak || {};
  // N2J TRINI footer r2 (sian jobs/n2jtrini_footer_reference_20261104). Static content stays complete without motion.
  const MARKUP = "<div class=\"ddak-tf-in\"><div class=\"ddak-tf-top\"><p>군산 기반 제작 스튜디오</p><p>엔투제이트리니</p></div><p class=\"ddak-tf-mark\">N2J TRINI<span class=\"ddak-tf-dot\" aria-hidden=\"true\">.</span></p><div class=\"ddak-tf-main\"><span class=\"ddak-tf-rule\" aria-hidden=\"true\"></span><section class=\"ddak-tf-contact\" aria-labelledby=\"ddak-tf-contact-title\"><h2 id=\"ddak-tf-contact-title\">프로젝트 문의</h2><a class=\"ddak-tf-email\" href=\"mailto:n2jtrini@gmail.com\">n2jtrini@gmail.com</a><a class=\"ddak-tf-phone\" href=\"tel:01026318279\">010-2631-8279</a></section><nav class=\"ddak-tf-ch\" aria-label=\"소셜 채널 · 새 창으로 열림\"><a href=\"https://www.instagram.com/n2j_ddalkkak_web_studio?igsh=MW14NHlieXFvNW9rcw%3D%3D&amp;utm_source=qr\" target=\"_blank\" rel=\"noopener noreferrer\" aria-label=\"인스타그램 (새 창)\">인스타그램<span aria-hidden=\"true\">↗</span></a><a href=\"https://youtube.com/@n2jtrini?si=zmLJ5wbruLfd7FVu\" target=\"_blank\" rel=\"noopener noreferrer\" aria-label=\"유튜브 (새 창)\">유튜브<span aria-hidden=\"true\">↗</span></a><a href=\"https://www.threads.com/@n2jtrini\" target=\"_blank\" rel=\"noopener noreferrer\" aria-label=\"스레드 (새 창)\">스레드<span aria-hidden=\"true\">↗</span></a><a href=\"https://blog.naver.com/jbe_123\" target=\"_blank\" rel=\"noopener noreferrer\" aria-label=\"네이버 블로그 (새 창)\">네이버 블로그<span aria-hidden=\"true\">↗</span></a></nav></div><section class=\"ddak-tf-biz\" aria-labelledby=\"ddak-tf-biz-title\"><h2 id=\"ddak-tf-biz-title\">사업자 정보</h2><dl><div class=\"ddak-tf-f\"><dt>상호</dt><dd>엔투제이트리니</dd></div><div class=\"ddak-tf-f\"><dt>대표</dt><dd>이현주</dd></div><div class=\"ddak-tf-f\"><dt>사업자등록번호</dt><dd>772-46-01252</dd></div><div class=\"ddak-tf-f ddak-tf-addr\"><dt>주소</dt><dd>전북특별자치도 군산시 미룡로 41</dd></div><div class=\"ddak-tf-f\"><dt>전화</dt><dd>010-2631-8279</dd></div><div class=\"ddak-tf-f\"><dt>이메일</dt><dd>n2jtrini@gmail.com</dd></div></dl></section></div>";
  // 0.1.5 footer motion = sian jobs/n2jtrini_motion_20261109 footer-motion.js r1 (WAAPI only). Resting state = r2 CSS unchanged.
  function motion(footer) {
    const $ = (s) => footer.querySelector(s), $$ = (s) => [...footer.querySelectorAll(s)];
    const mark = $('.ddak-tf-mark'), dot = $('.ddak-tf-dot'), rule = $('.ddak-tf-rule');
    if (!mark || !dot || !rule || !mark.animate || !('IntersectionObserver' in window)) return null;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // already on screen when JS arrives: keep the static design, no pop-in
    if (footer.getBoundingClientRect().top < innerHeight * 0.9) return { skipped: 'visible-at-load' };
    footer.classList.add('ddak-tf-pre');
    const EXPO = 'cubic-bezier(.16,1,.3,1)', UI = 'cubic-bezier(.22,1,.36,1)';
    const done = [];
    const run = (node, kf, o) => { const a = node.animate(kf, { fill: 'backwards', ...o }); done.push(a.finished.catch(() => {})); return a; };
    const state = { played: false, finished: false };
    function play() {
      state.played = true;
      try {
        footer.classList.remove('ddak-tf-pre');
        if (reduce) { // dissolve only, 150ms or less
          run(dot, [{ opacity: .68 }, { opacity: 1 }], { duration: 120, easing: UI });
          run(rule, [{ opacity: .35 }, { opacity: 1 }], { duration: 150, easing: UI });
          [...$$('.ddak-tf-contact>*'), ...$$('.ddak-tf-ch a'), ...$$('.ddak-tf-biz h2'), ...$$('.ddak-tf-f')]
            .forEach(n => run(n, [{ opacity: 0 }, { opacity: 1 }], { duration: 150, easing: 'linear' }));
        } else {
          dust();
          run(mark, [{ clipPath: 'inset(0 100% 0 0)', filter: 'blur(8px)' }, { clipPath: 'inset(0 0% 0 0)', filter: 'blur(0px)' }], { duration: 1100, easing: EXPO });
          run(dot, [{ opacity: .68, transform: 'scale(.78)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 420, delay: 760, easing: UI });
          run(rule, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 900, delay: 520, easing: UI });
          $$('.ddak-tf-contact>*').forEach((n, i) => run(n, [{ opacity: 0 }, { opacity: 1 }], { duration: 520, delay: 700 + i * 80, easing: UI }));
          $$('.ddak-tf-ch a').forEach((n, i) => run(n, [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)' }], { duration: 700, delay: 760 + i * 70, easing: EXPO }));
          [...$$('.ddak-tf-biz h2'), ...$$('.ddak-tf-f')].forEach((n, i) => run(n, [{ opacity: 0 }, { opacity: 1 }], { duration: 420, delay: 1000 + i * 45, easing: UI }));
        }
      } catch (_) { footer.classList.remove('ddak-tf-pre'); /* footer stays fully visible */ }
      // drop the animation layers once finished, so the resting footer is the plain CSS design
      Promise.all(done).then(() => { footer.getAnimations({ subtree: true }).forEach(a => a.cancel()); state.finished = true; });
    }
    function dust() {
      const c = document.createElement('canvas'); c.className = 'ddak-tf-dust'; c.setAttribute('aria-hidden', 'true');
      const fr = footer.getBoundingClientRect(), rr = rule.getBoundingClientRect();
      const W = Math.round(fr.width), H = Math.round(rr.top - fr.top + 24), dpr = Math.min(devicePixelRatio || 1, 2);
      const ctx = c.getContext && c.getContext('2d'); if (!ctx || W < 1 || H < 1) return;
      c.width = W * dpr; c.height = H * dpr; c.style.height = H + 'px';
      const pos = footer.style.position; if (getComputedStyle(footer).position === 'static') footer.style.position = 'relative'; // only while the canvas exists
      footer.prepend(c); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const x0 = rr.left - fr.left, len = rr.width, ly = rr.top - fr.top;
      const N = Math.max(80, Math.round(240 * len / 1152)); // 0.1.6: same dot density as PC 1440 (240 dots on a 1152px line) on every width (owner 2026-11-09 20:50)
      const P = Array.from({ length: N }, (_, i) => ({ x: x0 + Math.random() * len, y: Math.random() * Math.max(ly - 20, 1), tx: x0 + (i / (N - 1)) * len, ty: ly + (Math.random() - .5) * 2 }));
      const t0 = performance.now();
      const frame = (now) => {
        const t = now - t0;
        ctx.clearRect(0, 0, W, H);
        const alpha = t < 900 ? .34 : Math.max(0, .34 * (1 - (t - 900) / 600));
        ctx.fillStyle = `rgba(242,238,215,${alpha.toFixed(3)})`;
        for (const p of P) { p.x += (p.tx - p.x) * .06; p.y += (p.ty - p.y) * .06; ctx.fillRect(p.x, p.y, 1.6, 1.6); }
        if (t < 1500 && c.isConnected) requestAnimationFrame(frame); else { c.remove(); footer.style.position = pos; }
      };
      requestAnimationFrame(frame);
    }
    // observe the unclipped top row (the wordmark itself is clip-path hidden in the pre-state)
    const io = new IntersectionObserver((es) => { if (!es.some(e => e.isIntersecting)) return; io.disconnect(); play(); }, { threshold: 0, rootMargin: '0px 0px -8% 0px' });
    // also observe the whole footer: a jump scroll (anchor, End key) can skip the top row entirely and must not leave the footer hidden
    const top = $('.ddak-tf-top'); if (top) io.observe(top); io.observe(footer);
    return state;
  }
  function apply() {
    const nodes = document.querySelectorAll('footer.site-footer[aria-label="사이트 정보"]');
    if (nodes.length !== 1) throw new Error('REVIEW_FOOTER_TARGET');
    const footer = nodes[0];
    if (footer.dataset.ddakReviewFooter === 'true') return false;
    if (footer.querySelectorAll(':scope > .footer-social').length !== 1) throw new Error('REVIEW_FOOTER_DRIFT');
    const t = document.createElement('template'); t.innerHTML = MARKUP;
    footer.classList.add('ddak-footer', 'ddak-tf');
    footer.replaceChildren(t.content.cloneNode(true));
    footer.dataset.ddakReviewFooter = 'true';
    window.__ddak.reviewFooterMotion = motion(footer);
    window.__ddak.reviewController?.refresh();
    return true;
  }
  window.__ddak.reviewFooter = Object.freeze({apply});
})();

(function () {
  'use strict';
  window.__ddak = window.__ddak || {};
  // 0.1.5: portfolio cards show the internal status code URL_VERIFIED to visitors (home renderWorks()).
  // Text-only swap to the sian label '실제 운영 중' (spec §3). Home code, layout and data are not changed.
  const LABEL = {URL_VERIFIED: '실제 운영 중'};
  const fix = (host) => host.querySelectorAll('.works-item__meta span').forEach((n) => { const t = LABEL[n.textContent.trim()]; if (t) n.textContent = t; });
  function apply() {
    const host = document.querySelector('[data-works-list]');
    if (!host || host.dataset.ddakWorksLabel === 'true') return false;
    host.dataset.ddakWorksLabel = 'true';
    fix(host);
    if ('MutationObserver' in window) new MutationObserver(() => fix(host)).observe(host, {childList: true, subtree: true});
    return true;
  }
  window.__ddak.worksLabel = Object.freeze({apply});
})();

/* 0.1.6 flowing grids (sian jobs/n2jtrini_motion_20261109/portfolio-r2). Native rAF + pointer events, no library.
   flowEngine: one shared offset drives every row (cards left, counter rows right); drag/swipe follows the finger and
   releases with inertia, hover slows to a stop, pause button, focus brings a card into view, off-screen/hidden tab stop.
   Every position change is continuous (eased speed, ease-in-out nudge, decaying inertia): no one-frame jumps (D69).
   Reduced motion = static grid (host[data-flow="static"]): no copies, no buttons, no movement. */
(function () {
  'use strict';
  const ns = window.__ddak = window.__ddak || {};
  if (ns.flowEngine || typeof matchMedia !== 'function' || typeof IntersectionObserver !== 'function') return;
  const reduceMQ = matchMedia('(prefers-reduced-motion: reduce)'), fineMQ = matchMedia('(hover: hover) and (pointer: fine)');
  const mod = (a, b) => b > 0 ? ((a % b) + b) % b : 0;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const inOut = (p) => p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  // images fade in once decoded (no one-frame pop); a missing phone screenshot just drops the phone frame
  function fade(img) {
    const done = () => img.classList.add('ddak-fl-ok');
    if (img.complete && img.naturalWidth) done();
    else {
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', () => {
        const p = img.closest('.ddak-wf-phone'), s = img.closest('.ddak-wf-shot');
        if (p) p.remove();
        else if (s?.dataset.title) { const b = document.createElement('b'); b.textContent = s.dataset.title; s.classList.add('ddak-wf-type'); img.replaceWith(b); }
      }, { once: true });
    }
  }

  /* rows: [{row, track, group, dir: 1 (flows left) | -1 (flows right), ratio, deco (decorative band, follows scroll too)}] */
  function flowEngine({ host, stage, rows, pauseBtn, navs = [], speed, section = null, cursor = null, cardSel, entrance = null, onBuild = null }) {
    const st = { manual: false, hover: false, focus: false, visible: false, hidden: document.hidden, drag: null, wheelUntil: 0 };
    let s = 0, f = 0, vel = 0, rel = 0, lag = 0, tween = null, raf = 0, last = 0, zoom = 1, skew = 0, deco = 0, scrollV = 0, lastY = scrollY, disposed = false, built = false, lastW = -1, justDragged = 0, entered = false;
    const off = [];
    const on = (t, e, fn, o) => { t.addEventListener(e, fn, o); off.push(() => t.removeEventListener(e, fn, o)); };
    const isStatic = () => reduceMQ.matches;
    const main = rows[0];

    function clones(r) {
      r.track.querySelectorAll(':scope > [data-copy]').forEach((c) => c.remove());
      if (isStatic()) return 0;
      const gap = parseFloat(getComputedStyle(r.track).columnGap) || 0;
      const w = r.group.getBoundingClientRect().width / zoom + gap;
      if (w < 40) return 0;
      const need = Math.ceil(((r.row.clientWidth || innerWidth) * 2) / w) + 1;
      for (let i = 0; i < need; i++) {
        const c = r.group.cloneNode(true);
        // visual copy: opens like the original on click/tap (D207) but is skipped by Tab and screen readers
        c.dataset.copy = ''; c.setAttribute('aria-hidden', 'true'); c.removeAttribute('role');
        c.querySelectorAll('[role]').forEach((n) => n.removeAttribute('role'));
        c.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
        c.querySelectorAll('a,button').forEach((n) => n.setAttribute('tabindex', '-1'));
        c.querySelectorAll('img').forEach((n) => { n.loading = 'eager'; fade(n); });
        r.track.append(c);
      }
      return w;
    }
    function bleed() {
      if (!section) return;
      const sr = section.getBoundingClientRect(), hr = host.getBoundingClientRect();
      host.style.setProperty('--ddak-fl-l', Math.max(0, (hr.left - sr.left) / zoom) + 'px');
      host.style.setProperty('--ddak-fl-r', Math.max(0, (sr.right - hr.right) / zoom) + 'px');
    }
    function build() {
      if (disposed) return;
      zoom = (main.track.getBoundingClientRect().width / (main.track.offsetWidth || 1)) || 1;
      if (!isFinite(zoom) || zoom <= 0) zoom = 1;
      bleed();
      host.dataset.flow = isStatic() ? 'static' : 'on';
      const keep = main.W ? s / main.W : 0;
      rows.forEach((r) => { r.W = clones(r); });
      s = built ? keep * (main.W || 0) : -(parseFloat(host.style.getPropertyValue('--ddak-fl-l')) || 0); built = true;
      if (isStatic()) { rows.forEach((r) => { r.track.style.transform = ''; }); stop(); }
      render(); sync();
      onBuild?.();
    }
    function render() {
      if (isStatic()) return;
      for (const r of rows) {
        const o = s * r.ratio + (r.deco ? deco : 0);
        const x = r.dir > 0 ? -mod(o, r.W) : mod(o, r.W) - r.W;
        r.track.style.transform = `translate3d(${x.toFixed(2)}px,0,0)` + (!r.deco && Math.abs(skew) > .01 ? ` skewX(${(skew * r.dir).toFixed(3)}deg)` : '');
      }
    }
    const stopped = () => st.manual || st.focus || !st.visible || st.hidden;
    function frame(now) {
      raf = 0;
      if (disposed || isStatic()) return;
      const dt = last ? Math.min(now - last, 64) / 1000 : 1 / 60; last = now;
      const goal = (stopped() || st.hover || st.drag || tween || now < st.wheelUntil) ? 0 : 1;
      const tau = goal > f ? .6 : (st.manual ? .07 : st.hover ? .28 : .12);
      f += (goal - f) * (1 - Math.exp(-dt / tau)); if (Math.abs(goal - f) < (goal ? 1e-3 : .01)) f = goal;
      const s0 = s;
      // drag: the row eases toward the finger (90ms, like a lerp of .17 per frame) so uneven touch events still draw one continuous move
      if (st.drag) s += (st.drag.target - s) * (1 - Math.exp(-dt / .09));
      else if (tween) { const p = Math.min(1, (now - tween.t0) / tween.d); s = tween.from + (tween.to - tween.from) * inOut(p); if (p >= 1) tween = null; }
      else {
        if (lag) { const d = lag * (1 - Math.exp(-dt / .09)); s += d; lag -= d; if (Math.abs(lag) < .05) { s += lag; lag = 0; } }
        // release glide: constant friction (speed falls in a straight line to 0 within 0.45s), so the slowdown never lingers near zero
        if (vel) { const v0 = vel; vel -= Math.sign(v0) * Math.max(Math.abs(rel), 300) / .45 * dt; if (Math.sign(vel) !== Math.sign(v0)) vel = 0; s += (v0 + vel) / 2 * dt; }
        s += speed() * f * dt;
      }
      const ds = s - s0, manualV = (st.drag || vel || lag) ? ds / dt : 0;
      const goalSkew = clamp(-manualV * .0035, -5, 5);
      skew += (goalSkew - skew) * (1 - Math.exp(-dt / .12)); if (Math.abs(skew) < .01 && !goalSkew) skew = 0;
      const y = scrollY, sv = Math.min(Math.abs(y - lastY) / dt, 3000); lastY = y;
      scrollV += ((st.manual ? 0 : sv * .08) - scrollV) * (1 - Math.exp(-dt / .25)); if (scrollV < .3) scrollV = 0;
      deco += Math.min(scrollV, 220) * dt;
      render();
      const idle = f === 0 && goal === 0 && !st.drag && !tween && !vel && !lag && !skew && !scrollV;
      if (!idle && st.visible && !st.hidden) raf = requestAnimationFrame(frame); else last = 0;
    }
    const kick = () => { if (!raf && !disposed && built && !isStatic() && st.visible && !st.hidden) raf = requestAnimationFrame(frame); };
    function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; last = 0; }
    function sync() {
      if (disposed) return;
      if (pauseBtn) { pauseBtn.textContent = st.manual ? '흐름 재생' : '흐름 정지'; pauseBtn.setAttribute('aria-pressed', String(st.manual)); }
      host.dataset.running = String(!isStatic() && !stopped() && !st.hover);
      kick();
    }
    const step = () => { const c = main.group.firstElementChild; if (!c) return 0; return c.getBoundingClientRect().width / zoom + (parseFloat(getComputedStyle(main.group).columnGap) || 0); };
    function to(target, d) { vel = 0; target += lag; lag = 0; tween = { from: s, to: target, t0: performance.now(), d }; kick(); }
    navs.forEach((b) => on(b, 'click', () => { if (!isStatic()) to((tween ? tween.to : s) + Number(b.dataset.dir) * step(), 720); }));
    if (pauseBtn) on(pauseBtn, 'click', () => { st.manual = !st.manual; sync(); });

    // drag / swipe: follows the finger, releases with inertia; vertical gestures stay with the page (touch-action: pan-y)
    let d0 = null;
    const rowOf = (t) => rows.find((r) => !r.deco && r.row.contains(t)) || main;
    on(stage, 'pointerdown', (e) => {
      if (isStatic() || e.button > 0) return;
      const r = rowOf(e.target);
      d0 = { id: e.pointerId, x: e.clientX, y: e.clientY, s0: s, target: s, k: 1 / (r.dir * r.ratio), started: false, type: e.pointerType, pts: [[performance.now(), e.clientX]] };
    });
    on(stage, 'pointermove', (e) => {
      if (cursor && fineMQ.matches && e.pointerType === 'mouse') moveCursor(e);
      if (!d0 || e.pointerId !== d0.id) return;
      const dx = e.clientX - d0.x, dy = e.clientY - d0.y;
      if (!d0.started) {
        const thr = d0.type === 'mouse' ? 4 : 8;
        if (Math.abs(dx) < thr && Math.abs(dy) < thr) return;
        if (Math.abs(dy) > Math.abs(dx)) { d0 = null; return; }
        d0.started = true; d0.s0 = s + lag; lag = 0; d0.x = e.clientX; tween = null; vel = 0; st.drag = d0; host.dataset.dragging = '';
        try { stage.setPointerCapture(e.pointerId); } catch (_) { /* capture is optional */ }
      }
      d0.target = d0.s0 - (e.clientX - d0.x) / zoom * d0.k;
      const now = performance.now(); d0.pts.push([now, e.clientX]); while (d0.pts.length > 2 && now - d0.pts[0][0] > 120) d0.pts.shift();
      kick();
    });
    const release = (e) => {
      if (!d0 || (e && e.pointerId !== d0.id)) return;
      if (d0.started) {
        // release speed = finger speed over the last ~120ms (a finger that stopped before lifting gives ~0)
        const a = d0.pts[0], b = d0.pts[d0.pts.length - 1], dt = (performance.now() - a[0]) / 1000;
        vel = rel = dt > .01 ? clamp(-(b[1] - a[1]) / dt / zoom * d0.k, -1800, 1800) : 0;
        lag = d0.target - s; justDragged = performance.now(); delete host.dataset.dragging; st.drag = null; kick();
      }
      d0 = null;
    };
    on(stage, 'pointerup', release); on(stage, 'pointercancel', release);
    // touch pointers start with implicit capture on the touched child; moving capture to the stage fires lostpointercapture on that child (ignore it)
    on(stage, 'lostpointercapture', (e) => { if (e.target === stage) release(e); });
    on(stage, 'click', (e) => { if (performance.now() - justDragged < 350) { e.preventDefault(); e.stopPropagation(); } }, true);
    on(stage, 'dragstart', (e) => e.preventDefault());
    // horizontal trackpad scroll moves the rows (vertical wheel stays with the page)
    on(stage, 'wheel', (e) => {
      if (isStatic() || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault(); tween = null; vel = 0; s += e.deltaX / zoom; st.wheelUntil = performance.now() + 500; kick();
    }, { passive: false });
    // aria-hidden links (copies, decorative media) never take focus on mouse press
    on(stage, 'mousedown', (e) => { if (e.target.closest('[data-copy], [aria-hidden="true"]')) e.preventDefault(); });
    // hover slows the flow to a stop (fine pointer only)
    on(stage, 'pointerenter', (e) => { if (e.pointerType === 'mouse' && fineMQ.matches) { st.hover = true; sync(); } });
    on(stage, 'pointerleave', (e) => { if (e.pointerType === 'mouse') { st.hover = false; if (cursor) showCursor(false); sync(); } });
    // keyboard: focus stops the flow and brings the focused card fully into view
    on(stage, 'focusin', (e) => {
      st.focus = true; sync();
      const card = cardSel && e.target.closest(cardSel);
      if (!card || card.closest('[data-copy]') || isStatic()) return;
      const r = rowOf(card), rr = r.row.getBoundingClientRect(), b = card.getBoundingClientRect(), pad = 24;
      if (b.left < rr.left + pad || b.right > rr.right - pad) to(s + (b.left - rr.left - pad) / zoom * r.dir / r.ratio, 520);
    });
    on(stage, 'focusout', () => queueMicrotask(() => { st.focus = stage.contains(document.activeElement); sync(); }));
    on(document, 'visibilitychange', () => { st.hidden = document.hidden; if (st.hidden) stop(); sync(); });
    if (rows.some((r) => r.deco)) on(window, 'scroll', () => { if (st.visible && !st.manual) kick(); }, { passive: true });
    const onMQ = () => build();
    reduceMQ.addEventListener?.('change', onMQ); off.push(() => reduceMQ.removeEventListener?.('change', onMQ));

    // cursor label (fine pointer, motion on), positioned inside the host
    let cx = 0, cy = 0, tx = 0, ty = 0, craf = 0, shown = false;
    const label = cursor?.firstElementChild;
    function showCursor(v) {
      if (!label || v === shown || !label.animate) return; shown = v;
      label.animate([{ opacity: v ? 0 : 1, transform: `translate3d(-50%,-50%,0) scale(${v ? .6 : 1})` }, { opacity: v ? 1 : 0, transform: `translate3d(-50%,-50%,0) scale(${v ? 1 : .6})` }],
        { duration: v ? 240 : 160, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'forwards' });
    }
    function cframe() {
      craf = 0; cx += (tx - cx) * .22; cy += (ty - cy) * .22;
      cursor.style.transform = `translate3d(${cx.toFixed(1)}px,${cy.toFixed(1)}px,0)`;
      if (Math.abs(tx - cx) > .3 || Math.abs(ty - cy) > .3) craf = requestAnimationFrame(cframe);
    }
    function moveCursor(e) {
      if (isStatic()) return;
      const hr = host.getBoundingClientRect();
      tx = (e.clientX - hr.left) / zoom; ty = (e.clientY - hr.top) / zoom; if (!shown) { cx = tx; cy = ty; }
      showCursor(!!e.target.closest('.ddak-wf-media') && !st.drag);
      if (!craf) craf = requestAnimationFrame(cframe);
    }

    const io = new IntersectionObserver((es) => {
      const v = es.some((x) => x.isIntersecting);
      if (v && !st.visible && built && !entered) { entered = true; if (entrance && !isStatic()) entrance(); }
      st.visible = v; if (!v) stop(); sync();
    }, { threshold: 0 });
    const ro = new ResizeObserver(() => { const w = (section || host).getBoundingClientRect().width; if (Math.abs(w - lastW) < 2) return; lastW = w; build(); });
    // already on screen at mount -> no entrance (avoid a pop-in under the reader's eyes)
    const r0 = host.getBoundingClientRect(); if (r0.top < innerHeight && r0.bottom > 0) entered = true;
    host.querySelectorAll('img').forEach(fade);
    build();
    lastW = (section || host).getBoundingClientRect().width;
    io.observe(stage); ro.observe(section || host); off.push(() => { io.disconnect(); ro.disconnect(); });
    return {
      get state() { return { ...st, drag: !!st.drag, running: host.dataset.running === 'true' }; },
      get offset() { return s; }, get factor() { return f; }, get width() { return main.W; }, get zoom() { return zoom; },
      dispose() { if (disposed) return; disposed = true; stop(); if (craf) cancelAnimationFrame(craf); off.splice(0).forEach((fn) => fn()); },
    };
  }
  ns.flowEngine = flowEngine;
})();

(function () {
  'use strict';
  const ns = window.__ddak = window.__ddak || {};
  /* Works from the Imweb expert portfolio of N2J TRINI (imweb.me/expert/profile/6zbrl598), the three representative works first.
     0.1.7: owner 2026-11-10 "아임웹 포트폴리오 처럼 움직이는 커버사진" / "적힌주소로 유지해" / "그두개는 제외시켜":
     every card is a long full-page capture of the live site (own captures 2026-11-10, n2j-trini-assets tag covers-0.1.7-r2,
     desktop 1440 -> 900px wide, phone 390 -> 300px wide) that scrolls like the Imweb portfolio thumbnails. Captures stop above
     each site's footer (no representative names, phone numbers, bank accounts or e-mails) and customer reviews are blurred;
     SAI = the page sinsuy.imweb.me shows full-screen (skgns039-star.github.io/sinsu);
     코너플라워·세화 use the address written in the Imweb portfolio (same business numbers as the old addresses, both 200);
     N2J 홍보 랜딩·브라이트마인드 removed. '실제 운영 중' only where the live site is a running business. */
  // [id, name, category, URL, '실제 운영 중', desktop capture height, phone capture height] (capture widths 900 / 300)
  const COVERS = 'https://cdn.jsdelivr.net/gh/skgns039-star/n2j-trini-assets@covers-0.1.7-r2/assets/works/scroll/';
  const WORKS = [
    ['arthurnco', 'ARTHUR & CO.', 'BRAND DISTRIBUTION', 'https://arthurnco.imweb.me/', 1, 1488, 1639],
    ['duckfeet', 'DUCKFEET', 'WEBSITE', 'https://duckfeet11.imweb.me/', 1, 874, 669],
    ['vantamodus', 'VANTAMODUS', 'APPAREL', 'https://vantamodusk.imweb.me/apparel', 1, 1118, 1550],
    ['sai', 'SAI', 'PORTFOLIO', 'https://sinsuy.imweb.me/', 0, 2342, 2557],
    ['cornerflower', '코너플라워', 'FLOWER SHOP', 'https://cornerflower1.imweb.me/', 1, 2725, 3437],
    ['sehwa-construction', 'Sehwa Construction', 'CONSTRUCTION', 'https://onetag.imweb.me/', 1, 1662, 2030],
    ['embra', 'EMBRA', 'WEBSITE', 'https://embra01.imweb.me/', 1, 1655, 1271],
    ['naturesea-food', '네이처씨푸드', 'SEAFOOD STORE', 'https://www.nsfood.shop/', 1, 1016, 1065],
  ];
  const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const host = (u) => { try { const x = new URL(u); return (x.host + x.pathname).replace(/\/$/, ''); } catch (_) { return ''; } };

  function cardHTML(p, i) {
    // scroll time follows the page length (screen heights to travel), 4-12s
    const pd = Math.min(12, Math.max(4, 3 + 2.2 * (p.dh / 900 - .625))).toFixed(1);
    const shot = `<span class="ddak-wf-shot" data-title="${esc(p.title)}"><img src="${COVERS}${esc(p.id)}-desktop.webp" alt="" width="900" height="${p.dh}" loading="lazy" decoding="async" draggable="false"></span>`;
    return `<article class="ddak-wf-card" role="listitem" data-work-id="${esc(p.id)}" style="--ddak-pd:${pd}s">
<a class="ddak-wf-media" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer" tabindex="-1" aria-hidden="true" draggable="false">
<span class="ddak-wf-browser"><span class="ddak-wf-chrome"><i></i><i></i><i></i><span>${esc(host(p.url))}</span></span>${shot}</span>
<span class="ddak-wf-phone"><img src="${COVERS}${esc(p.id)}-mobile.webp" alt="" width="300" height="${p.mh}" loading="lazy" decoding="async" draggable="false"></span>
</a>
<div class="ddak-wf-info"><span class="ddak-wf-no" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
<h3 class="ddak-wf-title">${esc(p.title)}</h3>
<p class="ddak-wf-meta"><span>${esc(p.category)}</span>${p.live ? '<span class="ddak-wf-live">실제 운영 중</span>' : ''}</p>
<a class="ddak-wf-link" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer" draggable="false" aria-label="${esc(p.title)} 프로젝트 보기 (새 창)">프로젝트 보기 <span aria-hidden="true">↗</span></a></div>
</article>`;
  }

  function mount(list) {
    const items = WORKS.map(([id, title, category, url, live, dh, mh]) => ({ id, title, category, url, live: !!live, dh, mh }));
    const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
    const section = list.closest('section') || list.parentElement;
    const tpl = document.createElement('template');
    tpl.innerHTML = `<div class="ddak-wf-bar"><p class="ddak-wf-hint"><span class="ddak-wf-hint-flow">${fine ? '끌어서 넘겨 보세요. 마우스를 올리면 흐름이 멈춥니다.' : '옆으로 밀어서 넘겨 보세요.'}</span><span class="ddak-wf-hint-static">카드를 누르면 실제 사이트가 새 창으로 열립니다.</span></p>
<div class="ddak-wf-ctl"><button type="button" class="ddak-wf-nav" data-dir="-1" aria-label="이전 사례">←</button><button type="button" class="ddak-wf-nav" data-dir="1" aria-label="다음 사례">→</button><button type="button" class="ddak-wf-pause" aria-pressed="false">흐름 정지</button></div></div>
<div class="ddak-wf-stage" role="region" aria-label="운영 사례 ${items.length}곳"><div class="ddak-wf-row"><div class="ddak-wf-track"><div class="ddak-wf-group" role="list">${items.map(cardHTML).join('')}</div></div></div></div>
<div class="ddak-wf-names" aria-hidden="true"><div class="ddak-wf-ntrack"><div class="ddak-wf-ngroup">${items.map((p) => `<span>${esc(p.title)}</span><b></b>`).join('')}</div></div></div>
<div class="ddak-wf-cursor" aria-hidden="true"><span>사이트 보기 ↗</span></div>`;
    const frag = tpl.content, $ = (s) => frag.querySelector(s);
    const parts = { stage: $('.ddak-wf-stage'), row: $('.ddak-wf-row'), track: $('.ddak-wf-track'), group: $('.ddak-wf-group'), names: $('.ddak-wf-names'), ntrack: $('.ddak-wf-ntrack'), ngroup: $('.ddak-wf-ngroup'), pause: $('.ddak-wf-pause'), cursor: $('.ddak-wf-cursor'), navs: [...frag.querySelectorAll('.ddak-wf-nav')] };
    list.classList.add('ddak-wf');
    list.replaceChildren(frag);
    // preload every screenshot before the section is reached (no pop while dragging)
    const pre = new IntersectionObserver((es) => { if (!es.some((x) => x.isIntersecting)) return; pre.disconnect(); list.querySelectorAll('img[loading="lazy"]').forEach((i) => { i.loading = 'eager'; }); }, { rootMargin: '800px 0px' });
    pre.observe(list);
    // touch screens scroll the covers of the cards on screen only (copies included; they are rebuilt with the rows)
    const pan = new IntersectionObserver((es) => es.forEach((x) => x.target.toggleAttribute('data-pan', x.isIntersecting)), { threshold: 0 }); // a card leaving the screen is fully out before its cover returns to the top
    const api = ns.flowEngine({
      onBuild: () => { pan.disconnect(); list.querySelectorAll('.ddak-wf-card').forEach((c) => pan.observe(c)); },
      host: list, stage: parts.stage, section, cursor: parts.cursor, pauseBtn: parts.pause, navs: parts.navs, cardSel: '.ddak-wf-card',
      speed: () => innerWidth < 768 ? 20 : 40,
      rows: [{ row: parts.row, track: parts.track, group: parts.group, dir: 1, ratio: 1 }, { row: parts.names, track: parts.ntrack, group: parts.ngroup, dir: -1, ratio: 1.15, deco: true }],
      entrance() {
        const media = [...parts.group.querySelectorAll('.ddak-wf-browser')];
        const anims = media.map((m, i) => m.animate([{ clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)' }], { duration: 900, delay: Math.min(i, 5) * 90, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' }));
        Promise.all(anims.map((a) => a.finished.catch(() => {}))).then(() => anims.forEach((a) => a.cancel()));
      },
    });
    const dispose = api.dispose;
    api.dispose = () => { pre.disconnect(); pan.disconnect(); dispose(); };
    api.items = items.length;
    return api;
  }

  function apply() {
    const list = document.querySelector('[data-works-list]');
    if (!list || list.dataset.ddakWorksFlow) return false;
    list.dataset.ddakWorksFlow = 'pending';
    let api = null, busy = false, failed = false;
    const take = () => {
      if (busy || failed || !list.querySelector(':scope > .works-item')) return;
      busy = true;
      const orig = [...list.childNodes];
      try {
        api?.dispose();
        api = mount(list);
        list.__ddakWorksFlow = api; list.dataset.ddakWorksFlow = 'on';
        ns.reviewController?.refresh?.();
      } catch (err) {
        failed = true; api = null;
        list.classList.remove('ddak-wf'); list.replaceChildren(...orig);
        list.dataset.ddakWorksFlow = 'fallback';
        try { ns.worksLabel?.apply(); } catch (_) { /* label swap is best effort */ }
      } finally { busy = false; }
    };
    take();
    // the home renders (or re-renders) its own cards: take over again each time
    if ('MutationObserver' in window) new MutationObserver(take).observe(list, { childList: true });
    return true;
  }
  ns.worksFlow = Object.freeze({ apply, WORKS });
})();

(function () {
  'use strict';
  const ns = window.__ddak = window.__ddak || {};
  if (ns.reviewBoot) return;
  const scriptURL = document.currentScript?.src;
  function stylesheet(url, timeoutMs = 5000) {
    return new Promise((resolve,reject) => {
      const start = Date.now(); let timer, link;
      const cleanup = () => { clearTimeout(timer); link?.removeEventListener('error', failed); };
      const failed = () => { cleanup(); reject(new Error('REVIEW_STYLESHEET_FAILED')); };
      const poll = () => {
        const matches = [...document.querySelectorAll('link[rel="stylesheet"]')].filter(n => n.href === url);
        if (matches.length > 1) return failed();
        if (matches[0] && matches[0] !== link) {
          link = matches[0]; link.addEventListener('error', failed, {once:true});
        }
        if (link?.sheet && !link.disabled && (!link.media || matchMedia(link.media).matches)) { cleanup(); resolve(); return; }
        if (Date.now() - start >= timeoutMs) return failed();
        timer = setTimeout(poll,25);
      };
      poll();
    });
  }
  function start({renderer, styleURL = scriptURL && new URL('style.css',scriptURL).href,
    authorsURL = scriptURL && new URL('authors.json',scriptURL).href, timeoutMs} = {}) {
    if (['write','view','edit'].includes(new URLSearchParams(location.search).get('bmode'))) return [];
    const ready = () => styleURL ? stylesheet(styleURL,timeoutMs) : Promise.reject(new Error('REVIEW_STYLESHEET_MISSING'));
    const roots = [...document.querySelectorAll('[data-ddak-slot="n2j-reviews"][data-ddak-review-mode]')]
      .filter(root => ['home','intro'].includes(root.dataset.ddakReviewMode) && !root.dataset.ddakReviewBound);
    if (!roots.length) return [];
    return roots.map(root => ns.reviewController.mount({root, mode:root.dataset.ddakReviewMode,
      renderer, timeoutMs, authorsURL, ready:() => ready().then(() => { if (root.dataset.ddakReviewMode === 'home') { try { (ns.worksFlow || ns.worksLabel)?.apply(); } catch (_) { try { ns.worksLabel?.apply(); } catch (_) { /* best effort */ } } ns.reviewFooter.apply(); } })})).filter(Boolean);
  }
  ns.reviewBoot = Object.freeze({start, stylesheet});
  // Final .6 helper binding is supplied verbatim only after its handoff is verified.
  const boot = () => { start({renderer:ns.mountN2JReviews}); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
