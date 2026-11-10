(()=>{
/* Mesure d'audience anonyme (sans cookie) : une page vue = un signal vers /stat.php */
try{if(location.protocol==='https:'&&navigator.doNotTrack!=='1'&&navigator.sendBeacon)navigator.sendBeacon('/stat.php',new Blob([JSON.stringify({p:location.pathname,t:document.title,r:document.referrer})],{type:'text/plain'}));}catch(e){}
/* Opening a page from a link always starts at the top (back/forward keeps the reading position) */
(()=>{const nt=(performance.getEntriesByType&&performance.getEntriesByType('navigation')[0]||{}).type;
  if(location.hash||nt==='back_forward')return;
  try{history.scrollRestoration='manual';}catch(e){}
  let user=false;['wheel','touchstart','keydown','pointerdown'].forEach(ev=>addEventListener(ev,()=>{user=true;},{once:true,passive:true}));
  const top=()=>{if(user)return;const h=document.documentElement,s=h.style.scrollBehavior;h.style.scrollBehavior='auto';window.scrollTo(0,0);h.style.scrollBehavior=s;};
  top();addEventListener('DOMContentLoaded',top);addEventListener('load',()=>{top();setTimeout(top,60);});addEventListener('pageshow',top);})();
const nav=document.getElementById('nav'),btn=nav&&nav.querySelector('.menu');
if(btn){btn.addEventListener('click',()=>{const o=nav.classList.toggle('open');btn.setAttribute('aria-expanded',o);});
  nav.querySelectorAll('ul a').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('open');btn.setAttribute('aria-expanded','false');}));}
document.documentElement.classList.add('js');
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}}),{rootMargin:'0px 0px -8% 0px'});
document.querySelectorAll('.up').forEach(el=>io.observe(el));
const bar=document.querySelector('.readbar span'),prose=document.querySelector('.prose'),cover=document.querySelector('article .cover img');
if(bar||cover){let tk=false;const f=()=>{tk=false;
  if(bar&&prose){const r=prose.getBoundingClientRect();bar.style.setProperty('--p',Math.min(1,Math.max(0,(innerHeight-r.top)/(r.height+innerHeight*.4))));}
  if(cover&&!reduce){const r=cover.parentElement.getBoundingClientRect();cover.style.setProperty('--py',Math.max(-40,Math.min(40,r.top*-.06)).toFixed(1));}};
  addEventListener('scroll',()=>{if(!tk){tk=true;requestAnimationFrame(f);}},{passive:true});f();}
})();