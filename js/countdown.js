/* Countdown to the wedding; switches to "The Big Day Is Here", then "Just Married" */
(function(){
  "use strict";
  var target=new Date("2027-03-10T18:00:00+05:30").getTime(),
      married=new Date("2027-03-11T06:00:00+05:30").getTime(), // after the night's pheras
      doneState="";
  function showDone(state){
    if(doneState===state)return; doneState=state;
    var big=state==="married";
    document.querySelector(".timer").style.display="none";
    document.getElementById("countEyebrow").textContent=big?"Two Souls, Now One":"Today Two Souls Become One";
    document.getElementById("doneTitle").textContent=big?"Just Married":"The Big Day Is Here";
    document.getElementById("doneSub").textContent=big?"Thank you for your love & blessings":"The celebrations have begun";
    document.getElementById("timerDone").hidden=false;
  }
  function tick(){
    var now=Date.now();
    if(now>=married)return showDone("married");
    if(now>=target)return showDone("today");
    var total=Math.floor((target-now)/1000);
    function w(n,p){return String(n).padStart(p||2,"0")}
    document.getElementById("days").textContent=Math.floor(total/86400);
    document.getElementById("hours").textContent=w(Math.floor(total%86400/3600));
    document.getElementById("minutes").textContent=w(Math.floor(total%3600/60));
    document.getElementById("seconds").textContent=w(total%60);
  }
  tick();setInterval(tick,1000);
})();
