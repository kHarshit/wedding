/* Fades elements with .reveal in as they scroll into view */
(function(){
  "use strict";
  var obs=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add("in");obs.unobserve(e.target)}})},{threshold:.12});
  document.querySelectorAll(".reveal").forEach(function(el){obs.observe(el)});
})();
