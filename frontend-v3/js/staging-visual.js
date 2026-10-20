(function () {
'use strict';
var host=window.location.hostname;
var approved=host==='mylatinolist-staging.pages.dev'||/^(?:staging|v3-preview|mll-v2-dev|[a-f0-9]{8})\.mylatinolist-staging\.pages\.dev$/.test(host);
if(!approved)return;
var api='https://mll-api-staging.sparkling-hill-934f.workers.dev';
window.MLL_STAGING=Object.freeze({visualOnly:true,api:api,origin:window.location.origin});
var policy="default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https:; media-src https://media.mylatinolist.io; connect-src "+api+"; frame-src 'none'; object-src 'none'; form-action 'none'; base-uri 'self'";
document.write('<meta http-equiv="Content-Security-Policy" content="'+policy+'">');
var message='Visual-only staging: submissions and account/payment changes are disabled. / Prueba visual: los envíos y cambios de cuenta/pagos están desactivados.';
function blocked(){if(window.console)console.info(message);}
var nativeFetch=window.fetch.bind(window);
window.fetch=function(input,init){
 init=init||{};var method=String(init.method||(input&&input.method)||'GET').toUpperCase();var url;
 try{url=new URL(typeof input==='string'||input instanceof URL?input:input.url,window.location.href);}catch(e){return deny();}
 var path=/^\/api\/(?:businesses(?:\/[^/]+)?|jobs|marketplace|affiliates|resources|stats|ai\/status)\/?$/.test(url.pathname);
 if(url.origin!==api||!path||(method!=='GET'&&method!=='HEAD')||init.body!=null)return deny();
 return nativeFetch(input,Object.assign({},init,{redirect:'error',credentials:'omit'}));
};
function deny(){blocked();return Promise.resolve(new Response('{"error":"Visual-only staging: this action is disabled"}',{status:403,headers:{'Content-Type':'application/json'}}));}
window.XMLHttpRequest=function(){throw new Error(message);};
window.WebSocket=window.EventSource=function(){throw new Error(message);};
if(navigator.sendBeacon)navigator.sendBeacon=function(){blocked();return false;};
if(window.HTMLFormElement){HTMLFormElement.prototype.submit=blocked;HTMLFormElement.prototype.requestSubmit=blocked;}
document.addEventListener('submit',function(e){e.preventDefault();e.stopImmediatePropagation();blocked();},true);
document.addEventListener('click',function(e){
 var link=e.target.closest&&e.target.closest('a[href]');if(!link)return;var url;
 try{url=new URL(link.href,window.location.href);}catch(err){return;}
 if(/^(?:mylatinolist\.io|www\.mylatinolist\.io)$/.test(url.hostname)||/(?:^|\.)stripe\.com$/.test(url.hostname)||/^(?:mailto|tel):$/.test(url.protocol)){e.preventDefault();e.stopImmediatePropagation();blocked();}
},true);
document.addEventListener('DOMContentLoaded',function(){
 var banner=document.createElement('div');banner.id='mll-staging-notice';banner.setAttribute('role','note');banner.textContent=message;
 banner.style.cssText='position:relative;z-index:10000;padding:12px;background:#eaf3ff;color:#123e73;text-align:center;font:14px sans-serif';
 document.body.insertBefore(banner,document.body.firstChild);
});
})();
