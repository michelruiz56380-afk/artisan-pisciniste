
(()=>{

const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const ease=t=>1-Math.pow(1-t,3);

/* ===== Reviews (verbatim from Google) ===== */
const REVIEWS=[
 {n:"Kris Zoé",m:"Local Guide",c:"#7b6cf6",s:"Construction de piscine",t:"Après avoir étudié plusieurs devis, notre choix s'est naturellement porté sur Monsieur Rousseau, et nous en sommes ravis ! À la fois commercial, technicien, maître d'œuvre et homme de terrain, il a pris en charge notre projet de A à Z, avec l'avantage précieux de n'avoir qu'un seul et unique interlocuteur tout au long de la réalisation. […]"},
 {n:"Fatal Family",m:"8 avis",c:"#e0457b",s:"Pompe : réparation et installation",t:"Très satisfaits de notre pisciniste ! Un seul interlocuteur du début à la fin, toujours disponible et réactif. Les délais annoncés ont été parfaitement respectés et le travail est soigné. Nous recommandons sans hésitation !"},
 {n:"Le Goic",m:"3 avis",c:"#2f7d5b",s:"Pose de coque",t:"Merci à Olivier pour son bon travail, il m'a installé une coque et le résultat est magnifique. Travail rapide et soigné."},
 {n:"Sylvie Lamande-Hamel",m:"Local Guide",c:"#8a5a44",s:"Changement de liner",t:"Monsieur Rousseau vient de changer le liner de notre piscine. Il s'est occupé de tout de A à Z, de la vidange au redémarrage en passant par le remplissage. Il a été de précieux conseils sur plein d'autres points concernant l'entretien de notre piscine. Nous ferons désormais appel à lui sans hésiter."},
 {n:"Jean-Marc Kesler",m:"3 avis",c:"#5b6b7c",s:"Réparation de liner",t:"Mr Rousseau a affectue le changement du liner de ma piscine. Je suis très satisfait de sa prestation, sérieux, travail bien fait et planning respecté. Je recommande."},
 {n:"Michel Ruiz",m:"Local Guide",c:"#3b5cf0",s:"Construction de piscine",t:"J'ai fait appel à Monsieur Rousseau pour la construction de ma piscine il y a plus de 9 ans. Elle est toujours impeccable, et reste à ce jour l'une des plus belles réalisations de ma maison. Artisan méticuleux, rigoureux et exigeant, Monsieur Rousseau a livré un travail de très grande qualité. […]"},
 {n:"Ophélie Thomer",m:"9 avis",c:"#2a9d8f",s:"Installation de coque",t:"J ai contacté monsieur Rousseau pour l installation de ma piscine coque,nous sommes ravis,merci à lui pour son professionnalisme,vous pouvez lui faire confiance les yeux fermés."},
 {n:"Jim",m:"1 avis",c:"#3d8b5a",s:"Conseil et équipement",t:"Artisan très compétant du point de vue technique des équipements proposés\nÀ l'écoute de vos besoins, il saura vous aiguiller sur la meilleure solution qu'il pourrait vous offrir\nMr Rousseau s'occupe de votre projet de A à Z"},
 {n:"Anne Sophie Doublet",m:"Avis Google",c:"#8d4b2f",s:"Avis Google",t:"Un professionnel sérieux et appliqué dans son travail .\nDe très bon conseil, nous sommes très satisfait de son travail et referont appel à lui sans hésiter. Merci"}
];
const esc=s=>s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const card=(r,hidden)=>`<article class="rv"${hidden?' aria-hidden="true"':''}><header><span class="av" style="background:${r.c}">${esc(r.n[0])}</span><span class="who"><b>${esc(r.n)}</b><span>${esc(r.m)}</span></span></header><span class="stars" aria-label="5 étoiles sur 5">★★★★★</span><p>${esc(r.t).replace(/\n/g,'<br>')}</p><span class="svc">${esc(r.s)}</span></article>`;
const mq=document.getElementById('marquee');
const rows=[REVIEWS.slice(0,5),REVIEWS.slice(5)];
mq.innerHTML=rows.map((rw,i)=>`<div class="row${i?' rev':''}" style="--dur:${i?62:74}s">${rw.map(r=>card(r)).join('')}${reduce?'':rw.map(r=>card(r,true)).join('')}</div>`).join('');

/* ===== Hero: interactive water ripples over the photo ===== */
const hero=document.getElementById('top'), cv=document.getElementById('water');
const isTouch=matchMedia('(hover: none)').matches;
document.querySelector('#hint span').textContent=isTouch?"Touchez l'eau":"Passez la main sur l'eau";
(function water(){
  const gl=cv.getContext('webgl',{antialias:false,premultipliedAlpha:false});
  if(!gl){document.getElementById('hint').hidden=true;return;}
  const img=new Image();
  img.onload=()=>start(img);
  img.src=document.querySelector('.hero-img').src;
  function start(img){
    const vs='attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
    const fs=`precision mediump float;
    uniform sampler2D photo,hmap;uniform vec2 res,ims,tx;uniform float t;
    void main(){
      vec2 uv=gl_FragCoord.xy/res;
      float ra=res.x/res.y, ia=ims.x/ims.y;
      vec2 s=ra>ia?vec2(1.,ia/ra):vec2(ra/ia,1.);
      vec2 puv=(uv-.5)*s+.5; puv.y=1.-puv.y; puv.y=puv.y*.9+.06;
      float hl=texture2D(hmap,uv-vec2(tx.x,0.)).r, hr=texture2D(hmap,uv+vec2(tx.x,0.)).r;
      float hd=texture2D(hmap,uv-vec2(0.,tx.y)).r, hu=texture2D(hmap,uv+vec2(0.,tx.y)).r;
      vec2 n=vec2(hl-hr,hd-hu);
      vec3 col=texture2D(photo,puv+n*vec2(.09,-.09)).rgb;
      float sp=clamp(dot(n,vec2(-.55,.85))*7.,0.,1.);
      col+=vec3(.85,.97,1.)*sp*sp*.55;
      col-=vec3(.06,.04,0.)*clamp(-dot(n,vec2(-.55,.85))*7.,0.,1.);
      float sway=sin(uv.y*9.+t*.8)*.0015;
      gl_FragColor=vec4(col+sway,1.);
    }`;
    const sh=(ty,src)=>{const s=gl.createShader(ty);gl.shaderSource(s,src);gl.compileShader(s);return s;};
    const pr=gl.createProgram();gl.attachShader(pr,sh(gl.VERTEX_SHADER,vs));gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,fs));gl.linkProgram(pr);
    if(!gl.getProgramParameter(pr,gl.LINK_STATUS)){document.getElementById('hint').hidden=true;return;}
    gl.useProgram(pr);
    const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
    const loc=gl.getAttribLocation(pr,'p');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
    const U=n=>gl.getUniformLocation(pr,n);
    const mkTex=(unit)=>{const t=gl.createTexture();gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,t);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t;};
    mkTex(0);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,img);
    mkTex(1);gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);
    gl.uniform1i(U('photo'),0);gl.uniform1i(U('hmap'),1);gl.uniform2f(U('ims'),img.naturalWidth,img.naturalHeight);
    let W=0,H=0,a,bb,px;
    const size=()=>{
      const dpr=Math.min(devicePixelRatio||1,1.5);
      cv.width=cv.clientWidth*dpr|0;cv.height=cv.clientHeight*dpr|0;gl.viewport(0,0,cv.width,cv.height);
      gl.uniform2f(U('res'),cv.width,cv.height);
      W=180;H=Math.max(40,Math.round(W*cv.clientHeight/cv.clientWidth));
      a=new Float32Array(W*H);bb=new Float32Array(W*H);px=new Uint8Array(W*H);
      gl.uniform2f(U('tx'),1/W,1/H);
    };
    size();addEventListener('resize',size);
    const drop=(x,y,r,s)=>{ // x,y in 0..1, y from top
      const cx=x*W|0, cy=(1-y)*H|0;
      for(let j=-r;j<=r;j++)for(let i=-r;i<=r;i++){
        const X=cx+i,Y=cy+j; if(X<1||Y<1||X>=W-1||Y>=H-1)continue;
        const d=Math.sqrt(i*i+j*j); if(d>r)continue;
        a[Y*W+X]+=s*(Math.cos(d/r*Math.PI)*.5+.5);
      }
    };
    let last=null;
    hero.addEventListener('pointermove',e=>{
      const r=cv.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;
      if(last){const dx=x-last[0],dy=y-last[1];const sp=Math.min(1,Math.hypot(dx,dy)*30);drop(x,y,3,1.4*sp+.25);}else drop(x,y,3,.6);
      last=[x,y];
    });
    hero.addEventListener('pointerleave',()=>last=null);
    hero.addEventListener('pointerdown',e=>{const r=cv.getBoundingClientRect();drop((e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height,6,4);});
    const step=()=>{
      for(let y=1;y<H-1;y++){const o=y*W;for(let x=1;x<W-1;x++){const i=o+x;
        let v=(a[i-1]+a[i+1]+a[i-W]+a[i+W])*.5-bb[i]; v*=.972; bb[i]=v;}}
      const t=a;a=bb;bb=t;
      for(let i=0;i<W*H;i++){let v=a[i]*38+128;px[i]=v<0?0:v>255?255:v;}
      gl.activeTexture(gl.TEXTURE1);gl.texImage2D(gl.TEXTURE_2D,0,gl.LUMINANCE,W,H,0,gl.LUMINANCE,gl.UNSIGNED_BYTE,px);
    };
    let vis=true,raf=0,lastDrop=0;const t0=performance.now();
    const frame=now=>{
      if(!reduce&&now-lastDrop>900){drop(Math.random(),.45+Math.random()*.5,2+Math.random()*2|0,.9);lastDrop=now;}
      step();gl.uniform1f(U('t'),(now-t0)/1000);gl.drawArrays(gl.TRIANGLES,0,3);
      if(vis)raf=requestAnimationFrame(frame);
    };
    if(reduce){step();gl.drawArrays(gl.TRIANGLES,0,3);hero.addEventListener('pointermove',()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(frame);setTimeout(()=>{vis=false},2500);vis=true;});}
    else{raf=requestAnimationFrame(frame);new IntersectionObserver(([e])=>{vis=e.isIntersecting;cancelAnimationFrame(raf);if(vis)raf=requestAnimationFrame(frame);}).observe(hero);}
    cv.classList.add('on');
  }
})();

/* ===== Mini piscine in 3D ===== */
(function pool(){
  const stage=document.getElementById('stage');
  if(!window.THREE)return;
  let renderer;try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});}catch(e){return;}
  document.getElementById('fallback').hidden=true;
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
  stage.prepend(renderer.domElement);
  const scene=new THREE.Scene();
  const cam=new THREE.PerspectiveCamera(32,1,.1,100);
  scene.add(new THREE.HemisphereLight(0xffffff,0x7d8aa8,.95));
  const sun=new THREE.DirectionalLight(0xffffff,.75);sun.position.set(4,8,5);scene.add(sun);
  const L=4.25,Wd=2.35,D=1.5,T=.08;
  const shellMat=new THREE.MeshStandardMaterial({color:0x8f989e,roughness:.32,metalness:0});
  const copeMat=new THREE.MeshStandardMaterial({color:0xf1ede6,roughness:.85});
  const g=new THREE.Group();scene.add(g);
  const box=(w,h,d,x,y,z,m)=>{const me=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m||shellMat);me.position.set(x,y,z);g.add(me);return me;};
  box(L,T,Wd,0,-D,0);
  box(L,D,T,0,-D/2,Wd/2);box(L,D,T,0,-D/2,-Wd/2);
  box(T,D,Wd,L/2,-D/2,0);box(T,D,Wd,-L/2,-D/2,0);
  /* escalier d'angle : 3 marches triangulaires emboîtées */
  for(let k=1;k<=3;k++){const leg=.5+.4*k,h=D-.36*k;const sh=new THREE.Shape();sh.moveTo(0,0);sh.lineTo(leg,0);sh.lineTo(0,-leg);sh.lineTo(0,0);
    const me=new THREE.Mesh(new THREE.ExtrudeGeometry(sh,{depth:h,bevelEnabled:false}),shellMat);me.rotation.x=-Math.PI/2;me.position.set(-L/2+T/2,-D,-Wd/2+T/2);g.add(me);}
  const deckMat=new THREE.MeshStandardMaterial({color:0xcfc6b6,roughness:.95});
  const E=1.5,Hh=D+.12;
  box(L+2*E,Hh,E,0,-Hh/2,Wd/2+E/2,deckMat);box(L+2*E,Hh,E,0,-Hh/2,-Wd/2-E/2,deckMat);
  box(E,Hh,Wd,L/2+E/2,-Hh/2,0,deckMat);box(E,Hh,Wd,-L/2-E/2,-Hh/2,0,deckMat);
  const cw=.3,ct=.06;
  box(L+2*cw,ct,cw,0,ct/2,Wd/2+cw/2,copeMat);box(L+2*cw,ct,cw,0,ct/2,-Wd/2-cw/2,copeMat);
  box(cw,ct,Wd,L/2+cw/2,ct/2,0,copeMat);box(cw,ct,Wd,-L/2-cw/2,ct/2,0,copeMat);
  const wg=new THREE.PlaneGeometry(L-T,Wd-T,64,32);
  const waterMat=new THREE.MeshPhongMaterial({color:0x2b8aa0,transparent:true,opacity:.42,shininess:140,specular:0xffffff});
  const water=new THREE.Mesh(wg,waterMat);water.rotation.x=-Math.PI/2;water.position.y=-.12;g.add(water);
  const pos=wg.attributes.position;
  let theta=-.75,phi=.82,target={theta,phi},auto=!reduce,drag=null;
  const place=()=>{const r=11.5;cam.position.set(r*Math.sin(phi)*Math.cos(theta),r*Math.cos(phi)-.4,r*Math.sin(phi)*Math.sin(theta));cam.lookAt(0,-.55,0);};
  const resize=()=>{const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h,false);cam.aspect=w/h;cam.fov=w/h<1.1?42:32;cam.updateProjectionMatrix();};
  new ResizeObserver(resize).observe(stage);resize();
  const cvs=renderer.domElement;
  cvs.addEventListener('pointerdown',e=>{drag=[e.clientX,e.clientY,target.theta,target.phi];auto=false;cvs.setPointerCapture(e.pointerId);document.getElementById('drag').hidden=true;});
  cvs.addEventListener('pointermove',e=>{if(!drag)return;target.theta=drag[2]+(e.clientX-drag[0])*.008;if(e.pointerType!=='touch')target.phi=clamp(drag[3]-(e.clientY-drag[1])*.006,.45,1.25);});
  cvs.addEventListener('pointerup',()=>drag=null);cvs.addEventListener('pointercancel',()=>drag=null);
  let vis=false,raf=0;const t0=performance.now();
  const render=now=>{
    const t=(now-t0)/1000;
    if(auto)target.theta+=.0025;
    theta+=(target.theta-theta)*.08;phi+=(target.phi-phi)*.08;place();
    if(!reduce){for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i);pos.setZ(i,.018*Math.sin(x*3.1+t*1.6)+.012*Math.cos(y*4.3+t*1.2)+.008*Math.sin((x+y)*7+t*2.4));}
      pos.needsUpdate=true;wg.computeVertexNormals();}
    renderer.render(scene,cam);
    if(vis)raf=requestAnimationFrame(render);
  };
  place();renderer.render(scene,cam);
  new IntersectionObserver(([e])=>{vis=e.isIntersecting;cancelAnimationFrame(raf);if(vis)raf=requestAnimationFrame(render);}).observe(stage);
  document.querySelectorAll('.sw').forEach(btn=>btn.addEventListener('click',()=>{
    document.querySelectorAll('.sw').forEach(s=>s.setAttribute('aria-pressed',s===btn));
    shellMat.color.set(btn.dataset.shell);waterMat.color.set(btn.dataset.water);
    document.getElementById('sw-name').textContent=btn.dataset.name;
    if(!vis)renderer.render(scene,cam);
  }));
})();

/* ===== Scroll-driven scenes ===== */
const nav=document.getElementById('nav');
const story=document.getElementById('projet'), steps=[...document.querySelectorAll('#steps li')], prog=document.getElementById('prog');
const $=id=>document.getElementById(id);
const gal=$('gal'), track=$('track'), shots=[...track.querySelectorAll('.shot img')];
const solo=$('interlocuteur'), orbit=$('orbit');
if(reduce)solo.classList.add('static');
const rq=$('rq');
rq.innerHTML=rq.textContent.split(' ').map(w=>`<span class="w">${w}</span>`).join(' ');
const words=[...rq.querySelectorAll('.w')];
const narrow=matchMedia('(max-width: 760px)');
if(reduce)story.classList.add('static');
const galMode=()=>gal.classList.toggle('static',reduce||narrow.matches);galMode();narrow.addEventListener('change',galMode);

function setStory(p){
  const k=p*5, sp=i=>clamp(k-i);
  const active=Math.min(4,Math.floor(k));
  steps.forEach((li,i)=>li.classList.toggle('on',reduce?true:i===active));
  prog.style.setProperty('--p',p);
  $('stakes').style.opacity=1-sp(3)*.85;
  $('plan').style.opacity=sp(1)*(1-sp(3));
  const dig=ease(sp(2));
  $('holeRect').setAttribute('height',124*dig);
  $('pile').setAttribute('transform',`translate(668 192) scale(${dig}) translate(-668 -192)`);
  const s3=ease(sp(3));
  $('shell').style.opacity=s3>0?1:0;
  $('shell').setAttribute('transform',`translate(0 ${-260*(1-s3)})`);
  $('tech').style.opacity=clamp(sp(3)*2-1);
  const w=ease(sp(4)); $('waterRect').setAttribute('y',301-95*w);$('waterRect').setAttribute('height',95*w+2);
}
if(reduce)setStory(1);

let ticking=false;
function onScroll(){
  ticking=false;
  const vh=innerHeight;
  nav.classList.toggle('solid',scrollY>hero.offsetHeight-80);
  if(!reduce){
    const r=story.getBoundingClientRect();
    setStory(clamp(-r.top/(r.height-vh)));
  }
  if(!reduce){
    const r=solo.getBoundingClientRect();
    const o=orbit.getBoundingClientRect(),c=o.top+o.height/2;
    const p=solo.offsetHeight>vh*1.2?clamp(-r.top/(r.height-vh)*1.15):clamp((vh*.9-c)/(vh*.65));
    orbit.style.setProperty('--k',(1-ease(p)).toFixed(3));
  }
  if(!gal.classList.contains('static')){
    const r=gal.getBoundingClientRect(), p=clamp(-r.top/(r.height-vh));
    const max=track.scrollWidth-innerWidth;
    track.style.transform=`translateX(${-max*p}px)`;
    shots.forEach((im,i)=>im.style.setProperty('--sx',(p*(shots.length)-i).toFixed(3)));
  }
  if(!reduce){
    const r=rq.getBoundingClientRect(), p=clamp((vh*.85-r.top)/(vh*.6));
    words.forEach((w,i)=>w.style.setProperty('--o',(.18+.82*clamp(p*words.length*1.1-i)).toFixed(2)));
  }
}
addEventListener('scroll',()=>{if(!ticking){ticking=true;requestAnimationFrame(onScroll);}},{passive:true});
addEventListener('resize',onScroll);onScroll();

/* ===== Section entrances, counters ===== */

if(!reduce){
  const cio=new IntersectionObserver(es=>es.forEach(e=>{if(!e.isIntersecting)return;cio.unobserve(e.target);
    const el=e.target,to=+el.dataset.count,t0=performance.now();
    const f=now=>{const p=clamp((now-t0)/1400);el.textContent=Math.round(to*ease(p));if(p<1)requestAnimationFrame(f);};requestAnimationFrame(f);}),{threshold:.6});
  document.querySelectorAll('[data-count]').forEach(el=>cio.observe(el));
}

/* ===== Pointer effects: tile spotlight, magnetic buttons, tilting QR ===== */
document.querySelectorAll('.tile').forEach(t=>t.addEventListener('pointermove',e=>{const r=t.getBoundingClientRect();t.style.setProperty('--mx',e.clientX-r.left+'px');t.style.setProperty('--my',e.clientY-r.top+'px');}));
if(!reduce&&!isTouch){
  document.querySelectorAll('.mag').forEach(b=>{
    b.addEventListener('pointermove',e=>{const r=b.getBoundingClientRect();b.style.transform=`translate(${(e.clientX-r.left-r.width/2)*.18}px,${(e.clientY-r.top-r.height/2)*.3}px)`;});
    b.addEventListener('pointerleave',()=>b.style.transform='');
  });
  const qr=$('qr'),ar=$('realite-augmentee');
  ar.addEventListener('pointermove',e=>{const r=qr.getBoundingClientRect();qr.style.setProperty('--ry',((e.clientX-r.left-r.width/2)/r.width*16).toFixed(1)+'deg');qr.style.setProperty('--rx',(-(e.clientY-r.top-r.height/2)/r.height*16).toFixed(1)+'deg');});
  ar.addEventListener('pointerleave',()=>{qr.style.setProperty('--ry','0deg');qr.style.setProperty('--rx','0deg');});
}

/* ===== Form & copy ===== */
document.querySelectorAll('[data-project]').forEach(a=>a.addEventListener('click',()=>{const r=[...document.querySelectorAll('input[name=type]')].find(i=>i.value===a.dataset.project);if(r)r.checked=true;}));
document.querySelectorAll('.copy').forEach(btn=>btn.addEventListener('click',()=>{
  const el=$(btn.dataset.copy);const done=()=>{btn.textContent='Copié';setTimeout(()=>btn.textContent='Copier',1600);};
  try{navigator.clipboard.writeText(el.textContent).then(done,()=>getSelection().selectAllChildren(el));}catch(e){getSelection().selectAllChildren(el);}
}));
$('devis').addEventListener('submit',async e=>{
  e.preventDefault();const f=e.target,out=$('sent'),btn=f.querySelector('[type=submit]');out.hidden=false;
  if(!f.nom.value.trim()||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.value)){out.textContent="Indiquez votre nom et une adresse e-mail valide pour qu'Olivier puisse vous répondre.";return;}
  btn.disabled=true;out.textContent='Envoi en cours…';
  try{const r=await fetch(f.action,{method:'POST',body:new FormData(f),headers:{'Accept':'application/json'}});const j=await r.json();
    if(j.ok){f.reset();out.textContent='Merci, votre demande est bien partie. Olivier vous rappelle rapidement.';}
    else out.textContent=j.error||"L'envoi a échoué. Appelez directement le 06 52 08 92 19.";}
  catch(err){out.textContent="L'envoi a échoué. Appelez directement le 06 52 08 92 19.";}
  btn.disabled=false;
});
})();

/* ===== Supplier tabs ===== */
(()=>{const tabs=[...document.querySelectorAll('.seg [role=tab]')];if(!tabs.length)return;
const sel=t=>{tabs.forEach(b=>{const on=b===t;b.setAttribute('aria-selected',on);b.tabIndex=on?0:-1;document.getElementById(b.getAttribute('aria-controls')).hidden=!on;});};
tabs.forEach((b,i)=>{b.addEventListener('click',()=>sel(b));b.addEventListener('keydown',e=>{const d=e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0;if(d){const n=tabs[(i+d+tabs.length)%tabs.length];sel(n);n.focus();}});});})();
