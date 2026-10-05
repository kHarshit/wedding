/* Custom gold cursor for mouse users */
(function(){
  "use strict";
  var fine=window.matchMedia("(pointer:fine)").matches;
  if(fine){
    var dot=document.querySelector(".cursor-dot"),ring=document.querySelector(".cursor-ring");
    dot.classList.remove("hidden");ring.classList.remove("hidden");
    var rx=0,ry=0,dcx=0,dcy=0,rcx=0,rcy=0,cx=-100,cy=-100,tunes=false;
    document.addEventListener("mousemove",function(e){cx=e.clientX;cy=e.clientY;tunes=true;});
    (function loop(){
      dcx+=(cx-dcx)*.9;dcy+=(cy-dcy)*.9;rcx+=(cx-rcx)*.16;rcy+=(cy-rcy)*.16;
      dot.style.left=dcx+"px";dot.style.top=dcy+"px";
      ring.style.left=rcx+"px";ring.style.top=rcy+"px";
      requestAnimationFrame(loop);
    })();
    document.addEventListener("mouseover",function(e){
      var h=e.target.closest&&e.target.closest("a,button,.map-card,.event,.portrait");
      ring.classList.toggle("hovering",!!h);
    });
  }
  document.querySelectorAll("a,button").forEach(function(el){el.style.cursor="none"});
})();
