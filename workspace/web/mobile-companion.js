'use strict';
// The store companion has no subscription purchase links or checkout actions.
// This is presentation behavior, never an authorization boundary.
if(/RepPilotNative\//.test(navigator.userAgent)){
 document.documentElement.classList.add('native-companion');
 navItems.splice(0,navItems.length,...navItems.filter(n=>!['pricing','billing'].includes(n[0])));
 const renderBeforeMobile=render;render=function(){if(['pricing','billing'].includes(view)){view='overview';history.replaceState(null,'','#overview');}renderBeforeMobile();document.querySelectorAll('a[href="#pricing"],a[href="#billing"],[data-action^="billing-"]').forEach(x=>x.remove());};
 const bottom=document.createElement('nav');bottom.className='native-tabs';bottom.setAttribute('aria-label','Mobile navigation');bottom.innerHTML=[['overview','Today'],['territory','Map'],['route','Route'],['settings','Settings']].map(([id,label])=>`<a href="#${id}">${label}</a>`).join('');document.body.appendChild(bottom);
}
