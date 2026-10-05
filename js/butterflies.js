/* Three butterflies that flutter, glide and rest on ornaments */
(function(){
  "use strict";
  var F=document.getElementById("flutter");
  if(!F)return;
  var reduced=window.matchMedia&&window.matchMedia("(prefers-reduced-motion:reduce)").matches;
  if(reduced)return;
  var THEMES=[
    {gradFrom:"#e8c878",gradTo:"#8a6420",stroke:"#3d2b10",spot:"#f8efd4",vein:"rgba(61,43,16,0.55)",glow:"rgba(214,175,90,0.5)"},
    {gradFrom:"#fdfaf3",gradTo:"#cdbf94",stroke:"#6b5d3a",spot:"#fffaf0",vein:"rgba(107,93,58,0.5)",glow:"rgba(230,218,180,0.5)"},
    {gradFrom:"#eccab2",gradTo:"#a8674a",stroke:"#4a2a1c",spot:"#fbe9da",vein:"rgba(74,42,28,0.5)",glow:"rgba(220,170,140,0.5)"}
  ];
  var SHAPES=[
    {c:"M50 50 C 34 24, 6 10, 4 30 C 3 42, 12 50, 24 52 C 14 56, 5 60, 6 64 C 6 80, 14 94, 30 90 C 40 87, 46 70, 50 56 Z",
     v:"M50 46 C36 30, 20 22, 12 28",ws:"M50 54 C34 56, 18 62, 12 70",
     cx0:18,cy0:34,cr0:3.4,cx1:20,cy1:76,cr1:2.8},
    {c:"M50 48 C 32 20, 4 6, 2 26 C 1 38, 12 48, 24 50 C 14 54, 4 58, 6 62 C 5 76, 10 90, 24 92 C 22 98, 16 100, 14 96 C 22 94, 30 88, 34 80 C 40 74, 46 64, 50 54 Z",
     v:"M48 44 C34 28, 18 20, 10 26",ws:"M48 52 C32 54, 16 60, 10 68",
     cx0:16,cy0:32,cr0:3.2,cx1:16,cy1:72,cr1:2.6}
  ];
  function rand(a,b){return a+Math.random()*(b-a)}
  function rr(a){return Math.round(a)}
  function norm(a){a=a%360;if(a<0)a+=360;return a}
  function clamp(v,mn,mx){return v<mn?mn:v>mx?mx:v}
  function focusScale(){return clamp(Math.min(window.innerWidth,window.innerHeight)/800,.45,1.3)}
  function modeCfg(st){
    if(st==="flutter")return{speed:rand(35,60),flapFreq:rand(7,9),headingJitter:70,duration:rand(1200,2600)};
    if(st==="glide")return{speed:rand(20,32),flapFreq:rand(1.2,2),headingJitter:14,duration:rand(500,1100)};
    return{speed:0,flapFreq:.6,headingJitter:4,duration:rand(700,1600)};
  }
  var style=document.createElement("style");
  style.textContent="@keyframes shimmerPulse{0%,100%{opacity:.85}50%{opacity:1}}";
  document.head.appendChild(style);
  var small=window.innerWidth<640;
  var config=small?
    [{scale:1.3,blur:0,opacity:.95,z:3,speedMul:1.1},{scale:1,blur:0,opacity:1,z:2,speedMul:1},{scale:.8,blur:0,opacity:.9,z:1,speedMul:.9}]:
    [{scale:1.5,blur:1,opacity:.95,z:3,speedMul:1.15},{scale:1.1,blur:0,opacity:1,z:2,speedMul:1},{scale:.8,blur:.5,opacity:.85,z:1,speedMul:.85}];
  function wingSvg(th,sz,sh,gid){
    return '<svg width="'+sz+'" height="'+sz+'" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="'+gid+'" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="'+th.gradFrom+'"/><stop offset="100%" stop-color="'+th.gradTo+'"/></linearGradient></defs><g><path d="'+sh.c+'" fill="url(#'+gid+')" stroke="'+th.stroke+'" stroke-width="1.4"/><path d="'+sh.v+'" stroke="'+th.vein+'" stroke-width="0.8" fill="none"/><path d="'+sh.ws+'" stroke="'+th.vein+'" stroke-width="0.7" fill="none"/><circle cx="'+sh.cx0+'" cy="'+sh.cy0+'" r="'+sh.cr0+'" fill="'+th.spot+'"/><circle cx="'+sh.cx1+'" cy="'+sh.cy1+'" r="'+sh.cr1+'" fill="'+th.spot+'"/><g transform="scale(-1,1) translate(-100,0)"><path d="'+sh.c+'" fill="url(#'+gid+')" stroke="'+th.stroke+'" stroke-width="1.4"/><path d="'+sh.v+'" stroke="'+th.vein+'" stroke-width="0.8" fill="none"/><path d="'+sh.ws+'" stroke="'+th.vein+'" stroke-width="0.7" fill="none"/><circle cx="'+sh.cx0+'" cy="'+sh.cy0+'" r="'+sh.cr0+'" fill="'+th.spot+'"/><circle cx="'+sh.cx1+'" cy="'+sh.cy1+'" r="'+sh.cr1+'" fill="'+th.spot+'"/></g></g></svg>';
  }
  function bodySvg(th,sz){
    return '<svg width="'+sz+'" height="'+sz+'" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><ellipse cx="50" cy="50" rx="3.2" ry="15" fill="'+th.gradTo+'" stroke="'+th.stroke+'" stroke-width="0.8"/><circle cx="50" cy="33" r="2.8" fill="'+th.gradTo+'" stroke="'+th.stroke+'" stroke-width="0.6"/><path d="M50 33 C47 28, 44 24, 41 22" stroke="'+th.stroke+'" stroke-width="0.6" fill="none"/><path d="M50 33 C53 28, 56 24, 59 22" stroke="'+th.stroke+'" stroke-width="0.6" fill="none"/></svg>';
  }
  function pickRest(e){
    var spots=[];
    function vis(r){return r.bottom>-30&&r.top<window.innerHeight+30;}
    var bright=30;
    var tl=document.querySelector(".corner-floral.tl");
    if(tl){var r=tl.getBoundingClientRect();spots.push({x:r.left+r.width*.32,y:r.top+r.height*.38,pri:1});}
    var br=document.querySelector(".corner-floral.br");
    if(br){var r2=br.getBoundingClientRect();spots.push({x:r2.left+r2.width*.68,y:r2.top+r2.height*.6,pri:1});}
    document.querySelectorAll(".lotus-divider").forEach(function(el){
      var r=el.getBoundingClientRect();
      if(vis(r))spots.push({x:r.left+r.width/2,y:r.top+r.height/2,pri:1});
    });
    document.querySelectorAll(".portrait .box,.event .ev-img,.map-card,.card").forEach(function(el){
      var r=el.getBoundingClientRect();
      if(vis(r)){spots.push({x:r.left+12,y:r.top+12,pri:.6},{x:r.right-12,y:r.top+12,pri:.6},{x:r.left+12,y:r.bottom-12,pri:.6},{x:r.right-12,y:r.bottom-12,pri:.6});}
    });
    if(!spots.length)return null;
    var best=null,bd=1e9;
    spots.forEach(function(p){
      var d=Math.hypot(p.x-e.x,p.y-e.y)/Math.max(.4,p.pri);
      if(d<bd){bd=d;best=p;}
    });
    return {x:best.x,y:best.y};
  }
  var s=focusScale();
  var pointer={x:-9999,y:-9999};
  var list=[];
  var count=Math.min(3,3);
  for(var a=0;a<count;a++){
    var th=THEMES[a%THEMES.length];
    var ci=config[a%config.length];
    var sh=SHAPES[a%SHAPES.length];
    var sz=rand(34,52)*ci.scale;
    var id="b"+a;
    var d=document.createElement("div");
    d.style.cssText="position:absolute;left:0;top:0;width:"+sz+"px;height:"+sz+"px;z-index:"+ci.z+";pointer-events:none;will-change:transform";
    var m=document.createElement("div");
    m.style.cssText="position:absolute;inset:0;width:100%;height:100%;opacity:"+ci.opacity+";filter:"+(ci.blur>0?"blur("+ci.blur+"px) ":"")+"drop-shadow(0 0 "+rr(.14*sz)+"px "+th.glow+");transform-origin:50% 50%;animation:shimmerPulse "+rand(2.6,4)+"s ease-in-out infinite";
    m.innerHTML=wingSvg(th,Math.round(sz),sh,"wingGrad-"+id);
    var h=document.createElement("div");
    h.style.cssText="position:absolute;inset:0;width:100%;height:100%;opacity:"+ci.opacity+";filter:"+(ci.blur>0?"blur("+ci.blur+"px)":"none");
    h.innerHTML=bodySvg(th,Math.round(sz));
    d.appendChild(m);d.appendChild(h);F.appendChild(d);
    var mc=modeCfg("flutter");
    list.push({
      el:d,wingsEl:m,size:sz,speedMul:ci.speedMul,
      x:rand(.1,.85)*window.innerWidth,y:rand(.15,.7)*window.innerHeight,
      heading:rand(0,360),displayHeading:0,speed:0,
      state:"flutter",stateTimer:mc.duration,targetSpeed:mc.speed,
      flapFreq:mc.flapFreq,headingJitter:mc.headingJitter,
      flapPhase:Math.random()*Math.PI*2,restTarget:null
    });
  }
  var last=performance.now();
  var raf;
  function frame(t){
    var dt=Math.min(.05,(t-last)/1000);last=t;
    var W=window.innerWidth,H=window.innerHeight;
    list.forEach(function(e){
      e.stateTimer-=dt*1000;
      if(e.stateTimer<=0){
        var prev=e.state,p=Math.random();
        if(prev==="flutter")e.state=p<.55?"glide":p<.85?"flutter":"rest";
        else if(prev==="glide")e.state=p<.7?"flutter":"glide";
        else e.state="flutter";
        var mc=modeCfg(e.state);
        e.targetSpeed=mc.speed;e.flapFreq=mc.flapFreq;
        e.headingJitter=mc.headingJitter;e.stateTimer=mc.duration;
        e.restTarget=(e.state==="rest")?pickRest(e):null;
      }
      if(e.state==="rest"&&e.restTarget){
        var ax=e.restTarget.x-e.x,ay=e.restTarget.y-e.y;
        var ad=Math.sqrt(ax*ax+ay*ay);
        if(ad>6){
          var ha=norm(Math.atan2(ay,ax)*180/Math.PI);
          e.heading=norm(e.heading+(ha-e.heading)*.05);
          e.targetSpeed=26*s;
        }else{e.targetSpeed=0;}
      }
      e.speed+=(e.targetSpeed-e.speed)*.04;
      e.heading+=rand(-e.headingJitter,e.headingJitter)*dt;
      if(e.state!=="rest"){
        var m=e.x/W,h2=e.y/H,u=0,p2=0;
        if(m<.12)u=1;else if(m>.88)u=-1;
        if(h2<.12)p2=1;else if(h2>.88)p2=-1;
        if(u!==0||p2!==0){
          var target=norm(Math.atan2(p2,u)*180/Math.PI);
          e.heading=norm(e.heading+(target-e.heading)*.08);
        }
        var fx=e.x-pointer.x,fy=e.y-pointer.y;
        var dist=Math.sqrt(fx*fx+fy*fy);
        var v=140*s;
        if(dist<v){
          var ta=norm(Math.atan2(fy,fx)*180/Math.PI);
          e.heading=norm(e.heading+.15*(1-dist/v)*(ta-e.heading));
          e.targetSpeed=Math.max(e.targetSpeed,55*s);
        }
      }
      var b=e.heading*Math.PI/180;
      var hs=e.speed*e.speedMul*s;
      e.x+=Math.cos(b)*hs*dt;
      e.y+=Math.sin(b)*hs*dt;
      e.x=clamp(e.x,0,W-e.size);
      e.y=clamp(e.y,0,H-e.size);
      e.flapPhase+=e.flapFreq*Math.PI*2*dt;
      var w=Math.sin(e.flapPhase);
      var oy=e.state==="rest"?0:.04*e.size*s;
      e.displayHeading+=(e.heading-e.displayHeading)*.06;
      e.el.style.transform="translate3d("+e.x+"px,"+(e.y+w*oy)+"px,0) rotate("+(e.displayHeading+90)+"deg)";
      e.wingsEl.style.transform="scaleX("+((.42+(w+1)/2*.58))+")";
    });
    raf=requestAnimationFrame(frame);
  }
  function mv(ev){pointer.x=ev.clientX;pointer.y=ev.clientY}
  function tm(ev){var t=ev.touches&&ev.touches[0];if(t){pointer.x=t.clientX;pointer.y=t.clientY}}
  function te(){pointer.x=-9999;pointer.y=-9999}
  window.addEventListener("mousemove",mv,{passive:true});
  window.addEventListener("touchstart",tm,{passive:true});
  window.addEventListener("touchmove",tm,{passive:true});
  window.addEventListener("touchend",te,{passive:true});
  window.addEventListener("resize",function(){s=focusScale()});
  raf=requestAnimationFrame(frame);
})();
