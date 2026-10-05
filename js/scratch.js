/* Scratch-to-reveal heart with the wedding date, and confetti on reveal */
(function(){
  "use strict";
  var wrap=document.getElementById("scratchWrap"),canvas=document.getElementById("scratchCanvas");
  if(!wrap||!canvas)return;
  var ctx=canvas.getContext("2d"),W=0,H=0,dpr=Math.max(1,window.devicePixelRatio||1),scaled=false,done=false;
  var HEART="M 170 330 C 170 330 20 225 20 120 C 20 60 65 20 115 20 C 148 20 165 38 170 58 C 175 38 192 20 225 20 C 275 20 320 60 320 120 C 320 225 170 330 170 330 Z";
  function size(){
    var r=wrap.getBoundingClientRect();
    W=r.width;H=r.height;
    canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    scaled=true;
  }
  function traceHeart(){
    ctx.beginPath();
    var s=Math.min(W,H)/340,tokens=HEART.match(/([A-Z])|(-?\d*\.?\d+)/g),i=0,px=0,py=0;
    function n(){return parseFloat(tokens[i++])}
    ctx.save();ctx.scale(s,s);
    while(i<tokens.length){
      var cmd=tokens[i++];
      if(cmd==="M"){px=n();py=n();ctx.moveTo(px,py);}
      else if(cmd==="C"){var x1=n(),y1=n(),x2=n(),y2=n(),x=n(),y=n();ctx.bezierCurveTo(x1,y1,x2,y2,x,y);px=x;py=y;}
      else if(cmd==="Z"){ctx.closePath();}
    }
    ctx.restore();
  }
  function drawScratch(){
    ctx.clearRect(0,0,W,H);
    ctx.save();
    traceHeart();ctx.clip();
    var g=ctx.createLinearGradient(0,0,W,H);
    g.addColorStop(0,"#c08a1a");g.addColorStop(.5,"#a8720e");g.addColorStop(1,"#8a6010");
    ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    ctx.globalAlpha=.35;
    for(var x=-H;x<W+H;x+=34){
      ctx.strokeStyle="#f3e1bb";ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+H,H);ctx.stroke();
    }
    ctx.globalAlpha=.9;
    ctx.fillStyle="#fff8ee";
    ctx.font="600 20px Cinzel, Georgia, serif";
    var t="S C R A T C H",tw=ctx.measureText(t).width;
    ctx.save();ctx.translate(W/2,H/2);ctx.rotate(-.08);ctx.fillText(t,-tw/2,-2);ctx.restore();
    ctx.font="500 11px Cinzel, Georgia, serif";
    t="T O   R E V E A L";tw=ctx.measureText(t).width;
    ctx.save();ctx.translate(W/2,H/2);ctx.rotate(-.08);ctx.fillStyle="#f6e6c8";ctx.fillText(t,-tw/2,20);ctx.restore();
    ctx.globalAlpha=1;
    ctx.restore();
    ctx.save();traceHeart();
    ctx.strokeStyle="rgba(255,255,255,.25)";ctx.lineWidth=1.5;ctx.stroke();
    ctx.restore();
  }
  var brush=40,tick=0;
  function stamp(x,y){
    ctx.globalCompositeOperation="destination-out";
    ctx.beginPath();ctx.arc(x,y,brush/2,0,Math.PI*2);ctx.fill();
    ctx.globalCompositeOperation="source-over";
    if(--tick<=0){tick=10;check();}
  }
  function strokeTo(x1,y1,x2,y2){
    ctx.globalCompositeOperation="destination-out";
    ctx.lineCap="round";ctx.lineJoin="round";
    ctx.strokeStyle="rgba(0,0,0,1)";ctx.lineWidth=brush;
    ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
    ctx.globalCompositeOperation="source-over";
    if(--tick<=0){tick=10;check();}
  }
  function check(){
    if(done)return;
    var data=ctx.getImageData(0,0,canvas.width,canvas.height).data,cleared=0,total=0,step=8;
    for(var i=0;i<data.length;i+=step*4){total++;if(data[i+3]<60)cleared++;}
    if(total&&cleared/total>.58){done=true;wrap.classList.add("open");celebrate();}
  }
  function getPos(e){
    var r=canvas.getBoundingClientRect();
    return {x:e.clientX-r.left,y:e.clientY-r.top};
  }
  function celebrate(){
    if(document.getElementById("celebrate"))return;
    var cv=document.createElement("canvas");cv.id="celebrate";
    document.body.appendChild(cv);
    var ctx=cv.getContext("2d");
    var W=window.innerWidth,H=window.innerHeight,dpr=Math.max(1,window.devicePixelRatio||1);
    function sizeCanvas(){cv.width=W*dpr;cv.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);}
    sizeCanvas();
    window.addEventListener("resize",function(){W=window.innerWidth;H=window.innerHeight;sizeCanvas();});
    var colors=["#e9cf9a","#c8a45d","#eccab2","#d9a06b","#f8efd4","#8a6420","#b9887e"];
    var parts=[],t0=performance.now(),end=t0+5200,spawn=t0+2600;
    function add(){
      parts.push({
        x:Math.random()*W,y:-20-Math.random()*120,
        vy:2+Math.random()*4.5,vx:(Math.random()-.5)*2,
        s:6+Math.random()*9,c:colors[Math.floor(Math.random()*colors.length)],
        rot:Math.random()*Math.PI*2,vr:(Math.random()-.5)*.3,
        petal:Math.random()<.45,sw:Math.random()*Math.PI*2,sa:20+Math.random()*40
      });
    }
    for(var i=0;i<90;i++)add();
    function frame(now){
      ctx.clearRect(0,0,W,H);
      if(now<spawn&&parts.length<280)for(var k=0;k<3;k++)add();
      parts.forEach(function(p){
        p.vy+=.03;p.sw+=.05;
        p.x+=p.vx+Math.sin(p.sw)*.7;p.y+=p.vy;p.rot+=p.vr;
        ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot);
        ctx.globalAlpha=.92;ctx.fillStyle=p.c;
        if(p.petal){ctx.beginPath();ctx.ellipse(0,0,p.s,p.s*.45,0,0,Math.PI*2);ctx.fill();}
        else ctx.fillRect(-p.s/2,-p.s/2,p.s,p.s*.6);
        ctx.restore();
      });
      parts=parts.filter(function(p){return p.y<H+40});
      if(now<end){requestAnimationFrame(frame);}
      else{cv.parentNode.removeChild(cv);}
    }
    requestAnimationFrame(frame);
  }
  var drawing=false,last={x:0,y:0};
  canvas.addEventListener("pointerdown",function(e){e.preventDefault();drawing=true;var p=getPos(e);last=p;stamp(p.x,p.y);});
  canvas.addEventListener("pointermove",function(e){if(!drawing||done)return;e.preventDefault();var p=getPos(e);strokeTo(last.x,last.y,p.x,p.y);last=p;});
  window.addEventListener("pointerup",function(){drawing=false;check();});
  size();drawScratch();
  var ro=new ResizeObserver(function(){size();drawScratch();});
  ro.observe(wrap);
})();
