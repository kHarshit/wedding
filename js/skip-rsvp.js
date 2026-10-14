/* "RSVP ↓": a small pill by the music button for guests who just want to reply.
   It appears once the doors have opened, hides while the RSVP is on screen,
   and jumps straight there with the RSVP heading in view. */
(function(){
  "use strict";
  var pill=document.getElementById("skipRsvp"),intro=document.getElementById("intro"),rsvp=document.getElementById("rsvp");
  if(!pill||!rsvp)return;
  var open=false,near=false,past=false;
  // Shown once the doors are open, until the RSVP is on screen or behind us.
  function sync(){pill.classList.toggle("show",open&&!near&&!past);}
  function onScroll(){var p=rsvp.getBoundingClientRect().top<window.innerHeight*0.7;if(p!==past){past=p;sync();}}
  window.addEventListener("scroll",onScroll,{passive:true});
  if(!intro||intro.classList.contains("gone")){open=true;sync();}
  else new MutationObserver(function(_,mo){
    if(intro.classList.contains("gone")){mo.disconnect();setTimeout(function(){open=true;sync();},1600);}
  }).observe(intro,{attributes:true,attributeFilter:["class"]});
  if("IntersectionObserver" in window)new IntersectionObserver(function(es){near=es[es.length-1].isIntersecting;sync();},{rootMargin:"0px 0px -30% 0px"}).observe(rsvp);
  pill.addEventListener("click",function(e){
    e.preventDefault();
    if(window.weddingSections)window.weddingSections.cancel();
    var head=rsvp.querySelector(".rsvp-head")||rsvp;
    var top=head.getBoundingClientRect().top+window.scrollY-Math.max(16,window.innerHeight*0.06);
    // A long way in the 3D world: jump rather than fly through every place.
    var far=Math.abs(top-window.scrollY)>window.innerHeight*3;
    window.scrollTo({top:top,behavior:far||matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth"});
    var f=rsvp.querySelector("input[name=name]");
    if(f)setTimeout(function(){try{f.focus({preventScroll:true});}catch(x){}},far?60:900);
  });
})();
