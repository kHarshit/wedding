/* Intro gate: plays the door video on tap, then reveals the page. The music starts
   with the site (on load where allowed, otherwise on the first tap, swipe or key).
   js/world can stand in for the video with its 3D doors: it registers through
   window.weddingIntro.useGate({open:function(done,fallback){...}}), and the tap
   then calls open(begin, playVideo) instead of playing the video. */
(function(){
  "use strict";
  var main=document.querySelector("main"), intro=document.getElementById("intro"), musicBtn=document.getElementById("music");
  var started=false;
  var gateStarted=false;
  var gate=null;
  var v=document.querySelector("#intro video");

  function setPlaying(on){
    musicBtn.classList.toggle("playing",on);
    musicBtn.setAttribute("aria-pressed",on?"true":"false");
    musicBtn.setAttribute("aria-label",on?"Pause music":"Play music");
  }

  // The music starts with the site: on load if the browser allows sound
  // without a gesture, otherwise on the guest's first tap, swipe or key (the
  // same gesture that opens the doors), not when the doors have finished.
  var musicOn=false, retrying=false;
  function showMusicBtn(){musicBtn.style.opacity="1"; musicBtn.style.transform="scale(1)"; musicBtn.tabIndex=0;}
  function startMusic(fromGesture){
    var m=document.getElementById("wedding-music");
    if(!m||musicOn)return;
    m.preload="auto"; m.muted=false; m.volume=.35;
    // Only show the playing state once the browser actually allows playback
    var p=m.play();
    if(!p||!p.then){musicOn=true;showMusicBtn();setPlaying(true);return;}
    p.then(function(){
      if(musicOn)return; musicOn=true;
      showMusicBtn(); setPlaying(true);
      var r=0, iv=setInterval(function(){r++; m.volume=Math.min(1,.35+r*.0813); if(r>=8)clearInterval(iv);},50);
    }).catch(function(){
      if(musicOn)return;   // a later attempt (the tap) already got it playing
      m.volume=1;setPlaying(false);
      if(!fromGesture||retrying)return;
      // A mouse-wheel open is not a gesture the browser accepts for audio, so
      // start the music on the guest's next click, tap or key instead
      retrying=true;
      var retry=function(){
        ["pointerdown","keydown","touchend"].forEach(function(t){document.removeEventListener(t,retry,true);});
        retrying=false;
        if(!musicOn)startMusic(true);
      };
      ["pointerdown","keydown","touchend"].forEach(function(t){document.addEventListener(t,retry,true);});
    });
  }

  function begin(){
    if(started)return; started=true;
    unlockScroll();
    intro.classList.add("gone");
    // Out of the focus order and the accessibility tree once the doors are open.
    intro.setAttribute("tabindex","-1"); intro.setAttribute("aria-hidden","true");
    try{if(v)v.pause();}catch(e){}
    main.style.opacity="1"; main.style.pointerEvents="auto"; main.inert=false; main.removeAttribute("inert");
    main.style.transition="opacity 1.1s ease";
    var corners=main.querySelectorAll(".corner-floral");
    setTimeout(function(){corners.forEach(function(c){c.classList.remove("out");c.classList.add("in")})},250);
    if(!musicOn&&!retrying)startMusic(true); else showMusicBtn();
  }

  function playGate(){
    if(gateStarted)return; gateStarted=true;
    if(gate){
      setTimeout(function(){if(!started)begin();},20000);
      try{gate.open(begin,playVideo);}catch(e){playVideo();}
      return;
    }
    playVideo();
  }

  function playVideo(){
    if(!v)return begin();
    // Safety net if the video stalls after the tap (the clip is ~8s long)
    setTimeout(function(){if(!started)begin();},14000);
    try{
      v.muted=false; v.volume=1;
      var p=v.play();
      if(p&&p.catch)p.catch(function(){v.muted=true;v.play().catch(function(){});});
    }catch(e){begin();}
  }

  function openGate(){
    // Inside the guest's gesture, so the browser lets the music play
    startMusic(true);
    intro.classList.add("opening");
    if(started)return;
    if(v&&v.ended)begin(); else playGate();
  }
  intro.addEventListener("click",openGate);

  // Until the doors have opened the page stays at the top: a scroll, a swipe or
  // a scrolling key opens the doors just like a tap, instead of moving the page
  // underneath them and skipping the first sections.
  var root=document.documentElement, swiped=false, touchY=null;
  var SCROLL_KEYS={" ":1,Spacebar:1,PageDown:1,PageUp:1,ArrowDown:1,ArrowUp:1,End:1,Home:1,Enter:1};
  if("scrollRestoration" in history)history.scrollRestoration="manual";
  window.scrollTo(0,0);
  function locked(){return root.classList.contains("intro-lock");}
  function onWheel(e){if(!locked())return; e.preventDefault(); if(Math.abs(e.deltaY)+Math.abs(e.deltaX)>2)openGate();}
  function onKey(e){if(!locked()||!SCROLL_KEYS[e.key])return; e.preventDefault(); openGate();}
  function onTouchStart(e){if(!locked())return; swiped=false; touchY=e.touches[0]?e.touches[0].clientY:null;}
  function onTouchMove(e){
    if(!locked())return; e.preventDefault();
    if(touchY!=null&&e.touches[0]&&Math.abs(e.touches[0].clientY-touchY)>12)swiped=true;
  }
  // Open on touchend rather than touchmove: touchend counts as a user gesture,
  // so a swipe still unlocks the music on phones, exactly like a tap
  function onTouchEnd(){if(!locked()||!swiped)return; swiped=false; openGate();}
  function onScroll(){if(locked()&&(window.scrollY||root.scrollTop))window.scrollTo(0,0);}
  window.addEventListener("wheel",onWheel,{passive:false});
  window.addEventListener("keydown",onKey);
  window.addEventListener("touchstart",onTouchStart,{passive:true});
  window.addEventListener("touchmove",onTouchMove,{passive:false});
  window.addEventListener("touchend",onTouchEnd);
  window.addEventListener("scroll",onScroll,{passive:true});
  function unlockScroll(){
    window.scrollTo(0,0);
    root.classList.remove("intro-lock");
    window.removeEventListener("wheel",onWheel);
    window.removeEventListener("keydown",onKey);
    window.removeEventListener("touchstart",onTouchStart);
    window.removeEventListener("touchmove",onTouchMove);
    window.removeEventListener("touchend",onTouchEnd);
    window.removeEventListener("scroll",onScroll);
  }
  // Try at once: browsers that allow sound without a gesture (e.g. a return
  // visit on desktop Chrome) start the music as the site opens.
  startMusic(false);

  if(v){
    v.addEventListener("ended",begin);
    v.addEventListener("error",function(){if(!gate)begin();});
  }

  window.weddingIntro={
    useGate:function(g){gate=g||null;},
    state:function(){return started?"begun":gateStarted?"opening":"waiting";}
  };

  musicBtn.addEventListener("click",function(){
    var m=document.getElementById("wedding-music");
    if(m.paused){musicOn=true;m.play().then(function(){setPlaying(true)}).catch(function(){});}
    else{m.pause();setPlaying(false);}
  });
})();
