/* Previous / Next: two small buttons (bottom right) that glide the page to the
   previous or next moment, like a camera move, eased and paced to the
   distance. The guest still scrolls freely; the buttons are a way through for
   anyone who doesn't think to scroll.

   The moments ("beats"), in page order: the shloka, each family, the
   countdown and Save the Date, Our Story's heading, the portrait, the story's
   intro, each chapter and the names, the Celebrations heading, each event,
   the venue's heading, map and address, the RSVP, and the footer.
   - With the 3D world (js/world/main.js registers through useWorld()), each
     beat is placed inside its stop's range on the world's timeline, Our Story
     uses its own panels, and a glide waits until the places on its way are
     built.
   - On the cream site, the sections themselves.

   Pressing Next again during a glide carries on to the beat after it. Any
   input from the guest (a touch, the wheel, a scroll key, a press on the
   page) ends a glide where it is. With prefers-reduced-motion the buttons
   jump instead of gliding. */
(function(){
  "use strict";
  var prev=document.getElementById("secPrev"), next=document.getElementById("secNext");
  var intro=document.getElementById("intro"), main=document.querySelector("main"), root=document.documentElement;
  if(!prev||!next||!main||!window.requestAnimationFrame)return;

  var reduce=!!(window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches);
  var world=null;          // the 3D world's timeline, when it runs
  var began=false, glide=null, raf=0, lastNow=0, expectY=null, shifted=false, token=0;

  function q(s){return document.querySelector(s);}
  function vh(){return window.innerHeight||root.clientHeight||1;}
  function maxY(){return Math.max(0,root.scrollHeight-vh());}

  // ── The beats ──────────────────────────────────────────────────────────
  // { key, els, sec, stop?, final?, footer?, y? }
  function beats(){
    var B=[];
    function add(key,els,o){
      els=els.filter(function(e){return e&&e.getClientRects().length;});
      if(!els.length&&!(o&&o.y!=null))return;
      o=o||{}; B.push({key:key,els:els,sec:o.sec||key,stop:o.stop,final:o.final,footer:o.footer,y:o.y});
    }
    add("shloka",[q("#invite .gan-in")],{stop:"shrine"});
    var card=q("#invitation .card");
    if(card){
      var halves=card.querySelectorAll(":scope > .card-half"), close=card.querySelector(":scope > .card-close");
      if(halves.length===2){
        add("groom",[halves[0]],{sec:"card",stop:"homes"});
        add("bride",[halves[1],close],{sec:"card",stop:"homes"});
      }else{
        // The cream card: the groom's block runs from its label to the divider, the bride's to the close.
        var g=[],b=[],cur=null;
        Array.prototype.forEach.call(card.children,function(n){
          if(n.classList.contains("person-label"))cur=cur?b:g;
          if(!cur||n.classList.contains("card-divider")||n.classList.contains("card-corner"))return;
          cur.push(n);
        });
        add("groom",g,{sec:"card"});
        add("bride",b,{sec:"card"});
      }
    }
    var done_=q("#timerDone");
    add("countdown",[q(".count-sec .eyebrow"),q(".count-sec .timer"),done_&&!done_.hidden?done_:null],{sec:"terrace",stop:"terrace"});
    add("save-date",[q(".count-sec .scratch-sec"),q(".count-sec .save-date"),q(".count-sec .cal-links")],{sec:"terrace",stop:"terrace"});
    add("story-head",[q(".story-head")],{sec:"story-head"});
    add("portrait",[q(".story-sec .portrait")],{sec:"story-head"});
    var sb=world&&world.story&&world.story();
    if(sb)sb.forEach(function(s){add(s.key,[s.el],{sec:"story",y:s.y});});
    else Array.prototype.forEach.call(document.querySelectorAll(".story-sec .stop .chapter"),function(c,i){add("chapter-"+(i+1),[c],{sec:"story"});});
    add("celebrations",[q(".ev-sec .ev-head")],{stop:"haldi"});
    Array.prototype.forEach.call(document.querySelectorAll(".ev-sec .event"),function(e){
      var h=e.querySelector("h3");
      add("event-"+(h?h.textContent.trim().toLowerCase():"x"),[e],{stop:e.getAttribute("data-stop")});
    });
    add("venue-head",[q(".venue-head")],{sec:"venue",stop:"venue"});
    add("map",[q(".venue-sec .map-card")],{sec:"venue",stop:"venue"});
    add("venue-foot",[q(".venue-foot")],{sec:"venue",stop:"venue"});
    add("rsvp",[q(".rsvp-head"),q("#rsvpForm")],{stop:"rsvp",final:true});
    add("footer",[q("footer")],{footer:true});
    return B;
  }
  // Where a .reveal element (or one inside it) will sit once it has risen
  // into place: without the offset it starts from (js/reveal.js).
  function rise(e){
    var dy=0;
    for(var n=e;n&&n!==main;n=n.parentElement){
      if(!n.classList||!n.classList.contains("reveal"))continue;
      var m=(getComputedStyle(n).transform||"").match(/^matrix\(([^)]+)\)/);
      if(m)dy+=parseFloat(m[1].split(",")[5])||0;
    }
    return dy;
  }
  function rectOf(els){
    var sy=window.scrollY, top=Infinity, bottom=-Infinity;
    els.forEach(function(e){var r=e.getBoundingClientRect(); if(!r.height)return; var d=rise(e); top=Math.min(top,r.top+sy-d); bottom=Math.max(bottom,r.bottom+sy-d);});
    return top<bottom?{top:top,bottom:bottom}:null;
  }
  // The scroll position a beat reads best at: centred if it fits, else from
  // its top; held inside its stop on the world's timeline.
  function place(b,H,M){
    var y;
    if(b.footer)y=M;
    else if(b.y!=null)y=b.y;
    else{
      var r=rectOf(b.els); if(!r)return null;
      var h=r.bottom-r.top, room=H*(b.final?0.96:0.86);
      y=h<=room?(r.top+r.bottom)/2-H/2:r.top-Math.max(12,H*(b.final?0.02:0.07));
      if(world&&b.stop){var rg=world.range(b.stop); if(rg)y=Math.min(Math.max(y,rg[0]),rg[1]);}
    }
    return Math.min(Math.max(0,y),M);
  }
  // Positions. Beats of one section that would sit at nearly the same place
  // become one, and so does a beat that would sit at or above the one before
  // it (beside it, like the cream story's first chapters next to the portrait).
  function plan(){
    if(world&&world.measure)world.measure();
    var H=vh(), M=maxY(), out=[];
    beats().forEach(function(b){
      var y=place(b,H,M); if(y==null)return;
      var last=out[out.length-1];
      if(last&&!last.footer&&!b.footer&&(last.sec===b.sec&&Math.abs(y-last.y)<H*0.15||y<=last.y+Math.max(8,H*0.03))){
        last.key+="+"+b.key; last.els=last.els.concat(b.els); last.final=last.final||b.final;
        if(b.y==null&&last.yd==null){var y2=place({els:last.els,stop:last.stop,final:last.final},H,M); if(y2!=null)last.y=y2;}
        return;
      }
      out.push({key:b.key,y:y,yd:b.y,sec:b.sec,stop:b.stop,els:b.els,final:b.final,footer:b.footer});
    });
    return out;
  }
  function eps(){return Math.max(8,vh()*0.03);}
  function after(P,y){for(var i=0;i<P.length;i++)if(P[i].y>y+eps())return P[i]; return null;}
  function before(P,y){for(var i=P.length-1;i>=0;i--)if(P[i].y<y-eps())return P[i]; return null;}

  // ── The glide ──────────────────────────────────────────────────────────
  function glideTime(d){return Math.min(4.2,1.1+1.3*Math.sqrt(Math.abs(d)/vh()));}
  // Between two celebrations the camera crosses the estate and the hour
  // changes (morning, sunset, night): those moves get a little more time.
  var EVENT_SLOW=1.4;
  function isEvent(k){return /^event-/.test(k||"");}
  // A smooth trapezoid: ease in over a ramp, cruise, ease out (at most 1.2 s each end).
  function ease(t,dur){
    if(t<=0)return 0; if(t>=1)return 1;
    var a=Math.min(0.45,Math.max(0.2,1.2/Math.max(dur,0.01))), v=1/(1-a);
    function ramp(x){return v*(x/2-a/(2*Math.PI)*Math.sin(Math.PI*x/a));}
    if(t<a)return ramp(t);
    if(t>1-a)return 1-ramp(1-t);
    return v*(a/2+(t-a));
  }
  // "instant": the page's CSS asks for smooth scrolling, which would fight the glide.
  function setY(y){window.scrollTo({top:y,left:0,behavior:"instant"}); expectY=window.scrollY;}

  function go(dir){
    var P=plan();
    // From inside a glide, step on from where it is heading.
    var from=glide?glide.to:window.scrollY;
    var t=dir>0?after(P,from):before(P,from);
    // The moment the guest is leaving: where the page is (or a glide is heading).
    var here=null; for(var i=0;i<P.length;i++)if(Math.abs(P[i].y-from)<=eps()){here=P[i];break;}
    if(!t){sync();return;}
    var my=++token;
    var start=function(){
      if(my!==token)return;
      var y=window.scrollY, d=t.y-y;
      if(reduce||Math.abs(d)<1){cancel(); setY(t.y); expectY=null; sync(); return;}
      // Mid-glide: keep moving, re-aimed, from the current position.
      var dur=glideTime(d);
      if(here&&isEvent(here.key)&&isEvent(t.key))dur*=EVENT_SLOW;
      glide={from:y,to:t.y,t:0,dur:dur,key:t.key};
      expectY=y; lastNow=0; loop();
    };
    var r=world&&world.ready?world.ready(window.scrollY,t.y):true;
    if(r===true||!r||!r.then)start();
    else{var fired=false, fire=function(){if(!fired){fired=true; start();}}; r.then(fire,fire); setTimeout(fire,5000);}
  }
  function cancel(){glide=null; expectY=null; if(raf){cancelAnimationFrame(raf);raf=0;}}
  function tick(ts){
    raf=0;
    if(!glide)return;
    var t=ts/1000, dt=lastNow?Math.min(0.1,Math.max(0,t-lastNow)):0; lastNow=t;
    // Someone else moved the page (the scrollbar, a link): let them have it.
    // A change of layout (a place mounting, the URL bar) is not the guest.
    var y=window.scrollY;
    if(expectY!=null&&Math.abs(y-expectY)>2){
      if(shifted){var P=plan(); for(var i=0;i<P.length;i++)if(P[i].key===glide.key){glide.to=P[i].y;break;} expectY=y;}
      else{cancel(); sync(); return;}
    }
    shifted=false;
    glide.t+=glide.dur>0?dt/glide.dur:1;
    setY(glide.from+(glide.to-glide.from)*ease(glide.t,glide.dur));
    if(glide.t>=1){setY(glide.to); cancel(); sync(); return;}
    loop();
  }
  function loop(){if(!raf&&glide&&!document.hidden)raf=requestAnimationFrame(tick);}

  // ── The buttons ────────────────────────────────────────────────────────
  // Shown once the doors have opened; each hides where there's nowhere to go.
  function sync(){
    var y=glide?glide.to:window.scrollY, H=vh(), M=maxY();
    // Cheap enough for a scroll handler: the first beat sits at the top of the
    // shrine, the last one at the bottom of the page.
    var hasPrev=began&&y>eps(), hasNext=began&&y<M-eps();
    [[prev,hasPrev],[next,hasNext]].forEach(function(a){
      a[0].classList.toggle("show",a[1]); a[0].tabIndex=a[1]?0:-1;
      a[0].setAttribute("aria-hidden",a[1]?"false":"true");
    });
  }
  prev.addEventListener("click",function(){go(-1);});
  next.addEventListener("click",function(){go(1);});

  // Any input from the guest ends a glide where it is (the buttons don't).
  function ours(e){var t=e.target; return !!(t&&t.closest&&t.closest("#secPrev,#secNext,#music"));}
  var KEYS={" ":1,Spacebar:1,PageDown:1,PageUp:1,ArrowDown:1,ArrowUp:1,Home:1,End:1};
  function onInput(e){if(glide&&!ours(e)){cancel(); sync();}}
  window.addEventListener("wheel",onInput,{passive:true,capture:true});
  window.addEventListener("touchstart",onInput,{passive:true,capture:true});
  window.addEventListener("pointerdown",onInput,{passive:true,capture:true});
  window.addEventListener("keydown",function(e){if(glide&&KEYS[e.key]&&!ours(e)){cancel(); sync();}},true);
  if("ResizeObserver" in window)new ResizeObserver(function(){shifted=true;}).observe(main);
  window.addEventListener("resize",function(){shifted=true; sync();});
  document.addEventListener("visibilitychange",function(){if(!document.hidden&&glide){lastNow=0; expectY=window.scrollY; loop();}});
  var queued=false;
  window.addEventListener("scroll",function(){
    if(glide||!began||queued)return;
    queued=true; requestAnimationFrame(function(){queued=false; sync();});
  },{passive:true});

  function onBegin(){if(began)return; began=true; sync();}
  if(intro&&!intro.classList.contains("gone"))
    new MutationObserver(function(_,mo){if(intro.classList.contains("gone")){mo.disconnect();onBegin();}}).observe(intro,{attributes:true,attributeFilter:["class"]});
  else onBegin();

  window.weddingSections={
    // js/world/main.js: { measure(), range(stopName) -> [y0, y1], story() -> [{key, y, el}], ready(fromY, toY) -> true | Promise }
    useWorld:function(w){world=w||null; shifted=true;},
    cancel:function(){cancel(); sync();},
    next:function(){go(1);}, prev:function(){go(-1);},
    gliding:function(){return !!glide;},
    plan:function(){return plan().map(function(p){return {key:p.key,y:Math.round(p.y),final:!!p.final,footer:!!p.footer};});}
  };
})();
