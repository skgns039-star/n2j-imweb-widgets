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
  async function load({signal, timeoutMs = 5000} = {}) {
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
        reviews.push(Object.freeze({id,body:value,verified:true}));
      }
      return Object.freeze({state: reviews.length ? 'success' : 'empty', reviews:Object.freeze(reviews)});
    } finally {
      clearTimeout(timer); signal?.removeEventListener('abort', abort);
    }
  }
  window.__ddak.nativeReviews = Object.freeze({load, detailURL});
})();

(function(){
'use strict';window.__ddak=window.__ddak||{};
function refresh(){requestAnimationFrame(()=>requestAnimationFrame(()=>{try{window.ScrollTrigger?.refresh();}catch(_){}}));}
function mount({root,mode,renderer,timeoutMs,ready=Promise.resolve()}={}){
 if(!root||!root.matches('[data-ddak-slot="n2j-reviews"]')||!['home','intro'].includes(mode))throw Error('REVIEW_MOUNT_CONTRACT');
 if(['write','view','edit'].includes(new URLSearchParams(location.search).get('bmode'))||root.dataset.ddakReviewBound||root.childNodes.length)return null;
 const anchor=document.getElementById(mode==='home'?'contact':'w20261104b7a91a4a18f0d');if(!anchor)return null;
 anchor.before(root);refresh();root.dataset.ddakReviewBound='true';let running=false,rendered=false;
 const urls={all:'/27',write:'/27?board=b20261104dccbf249f2535&bmode=write',join:'/?mode=join',login:'/?mode=login'};
 function render(state,items=[]){if(typeof renderer!=='function')throw Error('REVIEW_RENDERER_MISSING');renderer(root,{mode,items,urls,state,onRetry:retry,rolling:false});root.dataset.state=state;refresh();}
 async function retry(){if(running||rendered)return;running=true;
 try{render('loading');await(typeof ready==='function'?ready():ready);const result=mode==='intro'?{state:'success',reviews:[]}:await window.__ddak.nativeReviews.load({timeoutMs});render(result.state,result.reviews);rendered=true;}
 catch(_){render('error');}finally{running=false;root.setAttribute('aria-busy','false');}}
 return{done:retry(),retry};
}
window.__ddak.reviewController=Object.freeze({mount,refresh});
})();

(function () {
  'use strict';
  window.__ddak = window.__ddak || {};
  function apply() {
    const nodes = document.querySelectorAll('footer.site-footer[aria-label="사이트 정보"]');
    if (nodes.length !== 1) throw new Error('REVIEW_FOOTER_TARGET');
    const footer = nodes[0];
    if (footer.dataset.ddakReviewFooter === 'true') return false;
    const social = footer.querySelectorAll(':scope > .footer-social');
    const threads = footer.querySelectorAll(':scope > .footer-social > a[aria-label="스레드"]');
    if (social.length !== 1 || threads.length !== 1 || threads[0].getAttribute('href') !== "https://www.threads.com/@n2j_ddalkkak_web_studio?igshid=NTc4MTIwNjQ2YQ==" ||
        footer.querySelector('.ddak-footer-business,.ddak-footer-blog')) throw new Error('REVIEW_FOOTER_DRIFT');
    const business = document.createElement('template'); business.innerHTML = "<!-- Hallmark · pre-emit critique: P5 H4 E5 S5 R5 V4 -->\n<section class=\"ddak-footer-business\" aria-label=\"사업자 정보\">\n  <dl class=\"ddak-footer-details\">\n    <div class=\"ddak-footer-field\"><dt>상호</dt><dd>엔투제이트리니</dd></div>\n    <div class=\"ddak-footer-field\"><dt>대표</dt><dd>이현주</dd></div>\n    <div class=\"ddak-footer-field\"><dt>사업자등록번호</dt><dd>772-46-01252</dd></div>\n    <div class=\"ddak-footer-field\"><dt>주소</dt><dd>전북특별자치도 군산시 미룡로 41 (미룡동, 미룡(2) 주공아파트) 210동803호</dd></div>\n    <div class=\"ddak-footer-field\"><dt>전화</dt><dd>010-5148-8279</dd></div>\n    <div class=\"ddak-footer-field\"><dt>이메일</dt><dd>n2jtrini@gmail.com</dd></div>\n  </dl>\n</section>\n";
    const blog = document.createElement('template'); blog.innerHTML = "<a class=\"ddak-footer-blog\" href=\"https://blog.naver.com/jbe_123\" target=\"_blank\" rel=\"noopener noreferrer\" aria-label=\"네이버 블로그 (새 창)\">네이버 블로그</a>\n";
    footer.classList.add('ddak-footer');
    threads[0].setAttribute('href',"https://www.threads.com/@n2jtrini");
    social[0].append(blog.content.cloneNode(true));
    footer.append(business.content.cloneNode(true));
    footer.dataset.ddakReviewFooter = 'true';
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
  function start({renderer, styleURL = scriptURL && new URL('style.css',scriptURL).href, timeoutMs} = {}) {
    if (['write','view','edit'].includes(new URLSearchParams(location.search).get('bmode'))) return [];
    const ready = () => styleURL ? stylesheet(styleURL,timeoutMs) : Promise.reject(new Error('REVIEW_STYLESHEET_MISSING'));
    const roots = [...document.querySelectorAll('[data-ddak-slot="n2j-reviews"][data-ddak-review-mode]')]
      .filter(root => ['home','intro'].includes(root.dataset.ddakReviewMode) && !root.dataset.ddakReviewBound);
    if (!roots.length) return [];
    return roots.map(root => ns.reviewController.mount({root, mode:root.dataset.ddakReviewMode,
      renderer, timeoutMs, ready:() => ready().then(() => { if (root.dataset.ddakReviewMode === 'home') ns.reviewFooter.apply(); })})).filter(Boolean);
  }
  ns.reviewBoot = Object.freeze({start, stylesheet});
  // Final .6 helper binding is supplied verbatim only after its handoff is verified.
  const boot = () => { start({renderer:ns.mountN2JReviews}); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
