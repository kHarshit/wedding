/* Floating gold specks */
(function(){
  "use strict";
  var wrap=document.getElementById("particles"),n=16;
  for(var i=0;i<n;i++){
    var p=document.createElement("span");p.className="particle";
    var s=Math.random()*2.5+1.5;
    p.style.width=s+"px";p.style.height=s+"px";
    p.style.left=(Math.random()*100)+"vw";
    p.style.setProperty("--dx",((Math.random()*120)-60)+"px");
    p.style.animationDuration=(6+Math.random()*6)+"s";
    p.style.animationDelay=(Math.random()*8)+"s";
    wrap.appendChild(p);
  }
})();
