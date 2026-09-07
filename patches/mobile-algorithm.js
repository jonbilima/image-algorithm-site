/* v2.4: actual image -> algorithm particles -> book transition in Auto/Lite mode.
   Uses the existing embedded artwork. No WebGL, hover, audio, network or storage.
   One capped 30 fps loop, only while the sticky scene is visible and motion is on. */
(() => {
  'use strict';
  const root = document.documentElement;
  const story = document.getElementById('story');
  const anchor = document.getElementById('story-anchor');
  const reliefSource = document.querySelector('#hero-anchor img');
  const coverSource = document.querySelector('#final-anchor img');
  if (!story || !anchor || !reliefSource || !coverSource || window.IA_ALGORITHM) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'ia-algorithm-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.hidden = true;
  const ctx = canvas.getContext('2d', { alpha:true });
  if (!ctx) return;
  anchor.appendChild(canvas);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = x => Math.min(1, Math.max(0, x));
  const smooth = (a,b,x) => { const t=clamp((x-a)/(b-a)); return t*t*(3-2*t); };
  const mix = (a,b,t) => a+(b-a)*t;
  const N=32, M=36, TAU=Math.PI*2;
  let tiles=[], ready=false, failed=false, frame=0, last=0, time=0, frames=0;
  let width=0, height=0, ratio=1, progress=0, active=false;
  const relief = new Image(), cover = new Image();
  let loaded=0;
  function stop() {
    if (frame) cancelAnimationFrame(frame);
    frame=0; last=0;
  }
  function hide() {
    active=false;
    canvas.hidden=true;
    anchor.classList.remove('ia-algorithm-active');
  }
  function fail(error) {
    failed=true; stop(); hide();
    window.IA_ALGORITHM_ERROR = String(error && error.message || error);
  }
  const allowed = () => ready && !failed && !document.hidden &&
    root.classList.contains('app-ready') && root.classList.contains('lite-effects') &&
    !root.classList.contains('webgl-ready') && !root.classList.contains('motion-paused') && !reduced.matches;
  function schedule() {
    if (!allowed()) { stop(); hide(); return; }
    if (!frame) frame=requestAnimationFrame(tick);
  }
  function setup() {
    if (++loaded !== 2) return;
    try {
      const sample=document.createElement('canvas'); sample.width=N; sample.height=M;
      const sc=sample.getContext('2d');
      if (!sc) throw new Error('Artwork sampling unavailable');
      sc.drawImage(relief,0,0,N,M);
      const data=sc.getImageData(0,0,N,M).data;
      let seed=24173;
      const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
      for(let y=0;y<M;y++) for(let x=0;x<N;x++) {
        const i=(y*N+x)*4, alpha=data[i+3]/255;
        const colour=alpha>.1 ? [data[i],data[i+1],data[i+2]] : (x<N/2?[226,183,111]:[73,190,207]);
        tiles.push({u:(x+.5)/N,v:(y+.5)/M,x,y,alpha,colour,
          phase:random()*TAU, radius:.15+random()*.3, speed:.24+random()*.22, drift:random()*TAU});
      }
      ready=true; schedule();
    } catch(error) { fail(error); }
  }
  relief.onload=setup; cover.onload=setup;
  relief.onerror=cover.onerror=()=>fail(new Error('Original artwork could not load'));
  relief.src=reliefSource.currentSrc || reliefSource.src;
  cover.src=coverSource.currentSrc || coverSource.src;
  function fit(image,margin) {
    const scale=Math.min((width-margin*2)/image.naturalWidth,(height-margin*2)/image.naturalHeight);
    return {w:image.naturalWidth*scale,h:image.naturalHeight*scale};
  }
  function draw(p) {
    const w=Math.max(1,Math.round(anchor.clientWidth)), h=Math.max(1,Math.round(anchor.clientHeight));
    const dpr=Math.min(window.devicePixelRatio||1,1.5);
    if(w!==width||h!==height||dpr!==ratio) {
      width=w; height=h; ratio=dpr;
      canvas.width=Math.round(w*dpr); canvas.height=Math.round(h*dpr);
    }
    ctx.setTransform(ratio,0,0,ratio,0,0);
    ctx.clearRect(0,0,width,height);
    const dissolve=smooth(.10,.48,p), gather=smooth(.52,.69,p);
    const field=dissolve*(1-gather), unit=Math.min(width,height);
    const face=fit(relief,Math.min(18,width*.07)), book=fit(cover,7);
    const fadeIn=smooth(.0,.18,dissolve), fadeOut=smooth(.75,1,gather);
    const pulse=Math.sin(time*.7)*1.5;
    // Readable source image stays sharp at both ends of the transition.
    ctx.globalAlpha=1-fadeIn;
    ctx.drawImage(relief,(width-face.w)/2,(height-face.h)/2,face.w,face.h);
    ctx.globalAlpha=1;
    if(field>.02) {
      const glow=ctx.createRadialGradient(width*.5,height*.5,0,width*.5,height*.5,unit*.5);
      glow.addColorStop(0,`rgba(54,163,185,${field*.1})`);glow.addColorStop(1,'rgba(54,163,185,0)');
      ctx.fillStyle=glow;ctx.fillRect(0,0,width,height);
      ctx.lineWidth=.6;
      for(let i=0;i<3;i++) {
        ctx.strokeStyle=`rgba(${i%2?'218,176,105':'69,167,185'},${field*.20})`;
        ctx.beginPath();ctx.ellipse(width*.5,height*.5,unit*(.26+i*.075),unit*(.10+i*.026),time*.10+i*.55,0,TAU);ctx.stroke();
      }
    }
    if(fadeIn>0 && fadeOut<1) {
      for(const tile of tiles) {
        const a=tile.phase+time*tile.speed;
        const z=Math.cos(a)*unit*tile.radius;
        const perspective=1/(1-z/(unit*2.8));
        const tx=Math.sin(a)*unit*tile.radius*perspective;
        const ty=((tile.v-.5)*height*.78+Math.sin(a+tile.drift)*height*.065)*perspective;
        const fx=(tile.u-.5)*face.w, fy=(tile.v-.5)*face.h;
        let x=mix(fx,tx,dissolve), y=mix(fy,ty,dissolve);
        x=mix(x,(tile.u-.5)*book.w,gather);
        y=mix(y,(tile.v-.5)*book.h,gather);
        x+=width*.5; y+=height*.5+pulse*field;
        const dot=(1.7+tile.radius*3.5)*perspective;
        const tw=mix(mix(face.w/N+.35,dot,dissolve),book.w/N+.35,gather);
        const th=mix(mix(face.h/M+.35,dot,dissolve),book.h/M+.35,gather);
        const opacity=fadeIn*(1-fadeOut);
        if(dissolve<.94 && tile.alpha>.02) {
          ctx.globalAlpha=opacity*(1-smooth(.35,.94,dissolve));
          ctx.drawImage(relief,tile.x*relief.naturalWidth/N,tile.y*relief.naturalHeight/M,
            relief.naturalWidth/N,relief.naturalHeight/M,x-tw/2,y-th/2,tw,th);
        }
        const pointAlpha=smooth(.25,.9,dissolve)*(1-gather)*mix(tile.alpha,.85,dissolve);
        if(pointAlpha>.005) {
          ctx.globalAlpha=opacity*pointAlpha*(.5+.45*perspective);
          ctx.fillStyle=`rgb(${tile.colour[0]},${tile.colour[1]},${tile.colour[2]})`;
          ctx.fillRect(x-tw/2,y-th/2,tw,th);
        }
        if(gather>0) {
          ctx.globalAlpha=opacity*gather;
          ctx.drawImage(cover,tile.x*cover.naturalWidth/N,tile.y*cover.naturalHeight/M,
            cover.naturalWidth/N,cover.naturalHeight/M,x-tw/2,y-th/2,tw,th);
        }
      }
    }
    if(fadeOut>0) {
      ctx.globalAlpha=fadeOut;
      ctx.drawImage(cover,(width-book.w)/2,(height-book.h)/2,book.w,book.h);
    }
    ctx.globalAlpha=1;
    frames++;
  }
  function tick(t) {
    frame=0;
    if(!allowed()) { hide(); last=0; return; }
    // Pause while a reading/quiz dialog is open; resume without a time jump.
    if(document.querySelector('dialog[open]')) { last=0; return; }
    const rect=story.getBoundingClientRect(), viewport=innerHeight;
    if(rect.top>viewport || rect.bottom<0) { hide(); last=0; return; }
    progress=clamp(-rect.top/Math.max(1,story.offsetHeight-viewport));
    // The first/final stills and hero keep the existing artwork/3D book controls.
    if(progress<.095 || progress>.70) { hide(); last=0; return; }
    if(last && t-last<1000/30) { frame=requestAnimationFrame(tick); return; }
    time+=last?Math.min((t-last)/1000,.08):0;
    last=t;
    try {
      draw(progress);
      // Hide the static fallback only after successful draw; never leave a blank scene.
      canvas.hidden=false; active=true;
      anchor.classList.add('ia-algorithm-active');
    } catch(error) { fail(error); return; }
    frame=requestAnimationFrame(tick);
  }
  addEventListener('scroll',schedule,{passive:true});
  addEventListener('resize',schedule,{passive:true});
  addEventListener('pageshow',schedule);
  addEventListener('pagehide',()=>{stop();hide();});
  document.addEventListener('visibilitychange',schedule);
  document.addEventListener('close',schedule,true);
  window.visualViewport?.addEventListener('resize',schedule,{passive:true});
  window.visualViewport?.addEventListener('scroll',schedule,{passive:true});
  reduced.addEventListener('change',schedule);
  new MutationObserver(schedule).observe(root,{attributes:true,attributeFilter:['class']});
  window.IA_ALGORITHM={version:'2.4',renderer:'canvas2d',get ready(){return ready;},
    get active(){return active;},get frames(){return frames;},get progress(){return progress;},
    get running(){return Boolean(frame);},get particles(){return tiles.length;},get failed(){return failed;}};
  root.dataset.algorithmVersion='2.4';
})();
