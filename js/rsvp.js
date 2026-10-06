/* RSVP form: saves responses to a Google Sheet; WhatsApp as an alternative */
(function(){
  "use strict";

  // ---- Setup (see README.md → "RSVP setup") ----
  // Web app URL from deploying apps-script/rsvp.gs, e.g. "https://script.google.com/macros/s/…/exec"
  var RSVP_ENDPOINT="";
  // WhatsApp number that receives RSVPs: country code + number, digits only, e.g. "919876543210"
  var WHATSAPP_NUMBER="";

  var form=document.getElementById("rsvpForm");
  if(!form)return;
  var status=form.querySelector(".rsvp-status"),
      nameIn=form.elements.name, guestsIn=form.elements.guests,
      buttons=[].slice.call(form.querySelectorAll("button[type=submit]")),
      alt=document.getElementById("rsvpAlt"), wa=document.getElementById("rsvpWhatsApp");

  function say(msg,isError){status.textContent=msg;status.classList.toggle("error",!!isError)}
  function guests(){var n=parseInt(guestsIn.value,10);return n>=1&&n<=20?n:""}
  // After accepting, offer the same "Add to Calendar" button as the dates section
  function showCalendar(){
    var cal=document.querySelector('.count-sec a.btn[href*="calendar.google.com"]');
    if(!cal||form.querySelector(".rsvp-cal"))return;
    var c=cal.cloneNode(true);
    c.classList.remove("reveal");c.removeAttribute("style");c.style.cursor=cal.style.cursor;
    c.classList.add("rsvp-cal");
    form.appendChild(c);
  }

  // WhatsApp: pre-fill the message with whatever the guest has typed
  if(WHATSAPP_NUMBER){
    alt.hidden=false;
    wa.addEventListener("click",function(){
      var lines=["Namaste! RSVP for Harshit & Deeksha's wedding (10 March 2027).",
                 "Name: "+(nameIn.value.trim()||""),
                 "Number of guests: "+(guests()||""),
                 "Attending: Yes"];
      wa.href="https://wa.me/"+WHATSAPP_NUMBER+"?text="+encodeURIComponent(lines.join("\n"));
    });
  }

  form.addEventListener("submit",function(e){
    e.preventDefault();
    var attending=(e.submitter&&e.submitter.value)||"Yes", name=nameIn.value.trim();
    nameIn.setAttribute("aria-invalid",name?"false":"true");
    if(!name){say("Please enter your name.",true);nameIn.focus();return;}
    if(form.elements.website.value)return; // bot
    if(!RSVP_ENDPOINT){say("RSVP isn't connected yet"+(WHATSAPP_NUMBER?" — please use WhatsApp below.":"."),true);return;}

    buttons.forEach(function(b){b.disabled=true});
    say("Sending…");
    var body=new URLSearchParams({name:name,guests:String(guests()),attending:attending});
    fetch(RSVP_ENDPOINT,{method:"POST",body:body})
      .then(function(r){return r.json()})
      .then(function(res){
        if(!res||!res.ok)throw new Error("not saved");
        form.classList.add("done");
        alt.hidden=true;
        if(attending==="Yes")showCalendar();
        say(attending==="Yes"
          ?"Thank you, "+name+"! We can't wait to celebrate with you."
          :"Thank you for letting us know, "+name+". You'll be missed!");
      })
      .catch(function(){
        buttons.forEach(function(b){b.disabled=false});
        say("Sorry, that didn't go through. Please try again"+(WHATSAPP_NUMBER?" or RSVP on WhatsApp.":"."),true);
      });
  });
})();
