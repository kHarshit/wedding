/* Scroll cue on the Ganesha screen: appears after the intro, hides once the guest scrolls */
(function(){
  "use strict";
  var cue=document.querySelector(".scroll-cue"),intro=document.getElementById("intro");
  if(!cue||!intro)return;
  var shown=false,dismissed=false;

  function show(){
    if(shown||dismissed)return; shown=true;
    setTimeout(function(){if(!dismissed&&window.scrollY<40)cue.classList.add("show");},1500);
  }
  function dismiss(){
    if(dismissed||window.scrollY<40)return; dismissed=true;
    cue.classList.remove("show");
    window.removeEventListener("scroll",dismiss);
  }

  // The page is revealed when the intro gets the "gone" class
  if(intro.classList.contains("gone"))show();
  else new MutationObserver(function(_,mo){
    if(intro.classList.contains("gone")){mo.disconnect();show();}
  }).observe(intro,{attributes:true,attributeFilter:["class"]});

  window.addEventListener("scroll",dismiss,{passive:true});
  cue.addEventListener("click",function(e){
    var target=document.getElementById("invitation");
    if(!target)return;
    e.preventDefault();
    target.scrollIntoView({behavior:"smooth",block:"start"});
  });
})();
