/* Intro gate: plays the door video on tap, then reveals the page and starts the music */
(function(){
  "use strict";
  var main=document.querySelector("main"), intro=document.getElementById("intro"), musicBtn=document.getElementById("music");
  var started=false;
  var gateStarted=false;
  var v=document.querySelector("#intro video");

  function setPlaying(on){
    musicBtn.classList.toggle("playing",on);
    musicBtn.setAttribute("aria-pressed",on?"true":"false");
    musicBtn.setAttribute("aria-label",on?"Pause music":"Play music");
  }

  function startMusic(){
    var m=document.getElementById("wedding-music");
    if(!m)return;
    musicBtn.style.opacity="1"; musicBtn.style.transform="scale(1)";
    m.muted=false; m.volume=.35;
    // Only show the playing state once the browser actually allows playback
    m.play().then(function(){
      setPlaying(true);
      var r=0, iv=setInterval(function(){r++; m.volume=Math.min(1,.35+r*.0813); if(r>=8)clearInterval(iv);},50);
    }).catch(function(){m.volume=1;setPlaying(false);});
  }

  // Called from the tap: starts buffering the music during the intro video and
  // unlocks playback on iOS, so it can start the moment the video ends.
  function primeMusic(){
    var m=document.getElementById("wedding-music");
    if(!m)return;
    m.preload="auto"; m.muted=true;
    var p=m.play();
    if(p&&p.then)p.then(function(){if(!started){m.pause();m.currentTime=0;}}).catch(function(){});
  }

  function begin(){
    if(started)return; started=true;
    intro.classList.add("gone");
    try{if(v)v.pause();}catch(e){}
    main.style.opacity="1"; main.style.pointerEvents="auto";
    main.style.transition="opacity 1.1s ease";
    var corners=main.querySelectorAll(".corner-floral");
    setTimeout(function(){corners.forEach(function(c){c.classList.remove("out");c.classList.add("in")})},250);
    startMusic();
  }

  function playGate(){
    if(gateStarted)return; gateStarted=true;
    if(!v)return begin();
    primeMusic();
    // Safety net if the video stalls after the tap (the clip is ~8s long)
    setTimeout(function(){if(!started)begin();},14000);
    try{
      v.muted=false; v.volume=1;
      var p=v.play();
      if(p&&p.catch)p.catch(function(){v.muted=true;v.play().catch(function(){});});
    }catch(e){begin();}
  }

  intro.addEventListener("click",function(){
    intro.classList.add("opening");
    if(started)return;
    if(v&&v.ended)begin(); else playGate();
  });
  if(v){
    v.addEventListener("ended",begin);
    v.addEventListener("error",begin);
  }

  musicBtn.addEventListener("click",function(){
    var m=document.getElementById("wedding-music");
    if(m.paused){m.play().then(function(){setPlaying(true)}).catch(function(){});}
    else{m.pause();setPlaying(false);}
  });
})();
