// Suppress Clerk errors + Framer Motion scroll warnings in dev/sandbox environments.
// Loaded via next/script beforeInteractive — runs before React hydration.
(function(){
  var oe=console.error;
  console.error=function(){
    var a=arguments[0];
    if(a&&typeof a==='object'&&a.name==='ClerkRuntimeError')return;
    if(typeof a==='string'&&a.indexOf('Clerk')!==-1)return;
    return oe.apply(console,arguments);
  };
  var ow=console.warn;
  console.warn=function(){
    var a=arguments[0];
    if(typeof a==='string'&&a.indexOf('non-static position')!==-1)return;
    return ow.apply(console,arguments);
  };
  window.addEventListener('unhandledrejection',function(e){
    if(e.reason&&(e.reason.name==='ClerkRuntimeError'||
      (e.reason.message&&e.reason.message.indexOf('Clerk')!==-1)))
      e.preventDefault();
  });
})();
