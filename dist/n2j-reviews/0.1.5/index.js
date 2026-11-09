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
 let manual=false,over=false,focus=false,visible=true,compact=false,lastSize='';const mq=matchMedia('(prefers-reduced-motion: reduce)');
 if(clean.length){if(!rolling||mode==='page'||clean.length<4){const list=el('div','ddak-rv-list');list.setAttribute('role','list');clean.forEach(x=>{const item=card(x,true);item.setAttribute('role','listitem');list.append(item)});root.append(list)}else{
 const btn=el('button','','흐름 정지');btn.type='button';btn.setAttribute('aria-pressed','false');actions.append(btn);
 const win=el('div','ddak-rv-window'),track=el('div','ddak-rv-track'),group=el('div','ddak-rv-group');clean.forEach(x=>group.append(card(x,false)));track.append(group);win.append(track);root.append(win);
 // Repeated visual copies are inert and excluded from the accessibility tree.
 const copy=group.cloneNode(true);copy.dataset.copy='';copy.inert=true;copy.setAttribute('aria-hidden','true');track.append(copy);
 const sync=()=>{if(disposed)return;const stop=manual||over||focus||!visible||document.hidden||mq.matches;track.style.animationPlayState=stop?'paused':'running';btn.hidden=mq.matches||compact;};
 const size=()=>{if(disposed)return;const width=group.getBoundingClientRect().width,gap=parseFloat(getComputedStyle(track).gap),speed=innerWidth<768?14:20,key=[width,win.clientWidth,gap,speed,mq.matches].join(':');if(key===lastSize){sync();return}lastSize=key;
 const transform=getComputedStyle(track).transform,offset=transform==='none'?0:-new DOMMatrixReadOnly(transform).m41;
 track.style.animationName='none';compact=width<win.clientWidth;copy.hidden=mq.matches||compact;
 if(mq.matches||compact){track.style.transform='none';sync();return}
 const distance=width+gap;track.style.removeProperty('transform');track.style.setProperty('--ddak-rv-distance',distance+'px');track.style.setProperty('--ddak-rv-duration',distance/speed+'s');track.style.animationDelay=-(offset%distance)/speed+'s';
 void track.offsetWidth;track.style.animationName='ddak-rv-flow';sync();};
 listen(btn,'click',()=>{manual=!manual;btn.textContent=manual?'흐름 재생':'흐름 정지';btn.setAttribute('aria-pressed',String(manual));sync()});listen(win,'mouseenter',()=>{over=matchMedia('(hover: hover) and (pointer: fine)').matches;sync()});listen(win,'mouseleave',()=>{over=false;sync()});listen(root,'focusin',()=>{focus=true;sync()});listen(root,'focusout',()=>{queueMicrotask(()=>{focus=root.contains(document.activeElement);sync()})});listen(document,'visibilitychange',sync);listen(mq,'change',size);const ro=new ResizeObserver(size),io=new IntersectionObserver(e=>{visible=e[0].isIntersecting;sync()});ro.observe(win);io.observe(win);removers.push(()=>{ro.disconnect();io.disconnect();track.style.animationName='none'});size();
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
  // 0.1.4: 작성자 = 성 + 가림 + 끝 글자 (홍길동→홍*동, 김수→김*, 남궁민수→남**수). 가림 글자는 이 한 곳만 바꾼다(예: 'x').
  const MASK = '*';
  const hidden = c => c === '*' || c === MASK;
  function maskName(value) {
    if (typeof value !== 'string') return '';
    const chars = Array.from(value.normalize('NFC').replace(/[\u0000-\u001F\u007F​-‍⁠﻿]/g, '').replace(/\s+/g, ''));
    // 한 글자는 가려도 전체가 드러나므로 표시하지 않는다(작성자 비공개).
    if (chars.length < 2 || chars.length > 40 || hidden(chars[0])) return '';
    if (chars.length === 2) return chars[0] + MASK;
    const last = chars[chars.length - 1];
    return chars[0] + MASK.repeat(Math.min(chars.length - 2, 3)) + (hidden(last) ? MASK : last);
  }
  // authors.json = {"authors":{"<게시글 idx>":"홍*동"}}. 가린 값만 담지만, 위젯이 한 번 더 가려 전체 이름이 실수로 들어가도 화면에 나오지 않는다.
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
      const N = W > 900 ? 240 : 120;
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
      renderer, timeoutMs, authorsURL, ready:() => ready().then(() => { if (root.dataset.ddakReviewMode === 'home') { try { ns.worksLabel?.apply(); } catch (_) {} ns.reviewFooter.apply(); } })})).filter(Boolean);
  }
  ns.reviewBoot = Object.freeze({start, stylesheet});
  // Final .6 helper binding is supplied verbatim only after its handoff is verified.
  const boot = () => { start({renderer:ns.mountN2JReviews}); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
