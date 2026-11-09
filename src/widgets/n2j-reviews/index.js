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
  function motion(footer) {
    const dot = footer.querySelector('.ddak-tf-dot'), rule = footer.querySelector('.ddak-tf-rule');
    if (!dot || !rule || !dot.animate || !('IntersectionObserver' in window)) return;
    const ease = 'cubic-bezier(.22,1,.36,1)';
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      try {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          dot.animate([{opacity: .68}, {opacity: 1}], {duration: 120, easing: ease});
          rule.animate([{opacity: .35}, {opacity: 1}], {duration: 150, delay: 60, easing: ease, fill: 'backwards'});
        } else {
          dot.animate([{opacity: .68, transform: 'scale(.78)'}, {opacity: 1, transform: 'none'}], {duration: 420, easing: ease});
          rule.animate([{transform: 'scaleX(0)'}, {transform: 'scaleX(1)'}], {duration: 420, delay: 80, easing: ease, fill: 'backwards'});
        }
      } catch (_) { /* footer stays fully visible */ }
    }, {threshold: .05, rootMargin: '0px 0px -5% 0px'});
    io.observe(footer.querySelector('.ddak-tf-mark') || footer);
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
    motion(footer);
    window.__ddak.reviewController?.refresh();
    return true;
  }
  window.__ddak.reviewFooter = Object.freeze({apply});
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
      renderer, timeoutMs, authorsURL, ready:() => ready().then(() => { if (root.dataset.ddakReviewMode === 'home') ns.reviewFooter.apply(); })})).filter(Boolean);
  }
  ns.reviewBoot = Object.freeze({start, stylesheet});
  // Final .6 helper binding is supplied verbatim only after its handoff is verified.
  const boot = () => { start({renderer:ns.mountN2JReviews}); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
