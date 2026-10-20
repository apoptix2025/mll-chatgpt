// SVG images are independent of Windows regional-indicator emoji support.
(() => {
  function image(lang){const i=document.createElement('img');i.src='/assets/flags/'+(lang==='es'?'es':'us')+'.svg';i.alt='';i.width=24;i.height=18;i.className='language-flag';return i;}
  function decorate(){
    document.querySelectorAll('.lang-btn[data-lang]').forEach(b=>{const lang=b.dataset.lang;b.replaceChildren(image(lang),document.createTextNode(' '+lang.toUpperCase()));b.setAttribute('aria-label',lang==='es'?'Español':'English');});
    const select=document.querySelector('#lang');if(!select||select.dataset.svgFlags)return;select.dataset.svgFlags='true';select.hidden=true;select.style.display='none';
    const wrapper=document.createElement('div');wrapper.className='language-picker';const trigger=document.createElement('button');trigger.type='button';trigger.className='language-current';trigger.setAttribute('aria-haspopup','menu');trigger.setAttribute('aria-expanded','false');
    const menu=document.createElement('div');menu.className='language-menu';menu.setAttribute('role','menu');menu.hidden=true;menu.id='language-menu';trigger.setAttribute('aria-controls',menu.id);
    function close(){menu.hidden=true;trigger.setAttribute('aria-expanded','false');}
    function refresh(){const lang=select.value==='es'?'es':'en';trigger.replaceChildren(image(lang),document.createTextNode(' '+lang.toUpperCase()));trigger.setAttribute('aria-label',lang==='es'?'Idioma: Español. Cambiar idioma':'Language: English. Change language');}
    for(const lang of ['en','es']){const b=document.createElement('button');b.type='button';b.setAttribute('role','menuitemradio');b.setAttribute('aria-checked',String(select.value===lang));b.setAttribute('aria-label',lang==='es'?'Español':'English');b.replaceChildren(image(lang),document.createTextNode(' '+lang.toUpperCase()));b.addEventListener('click',()=>{select.value=lang;close();refresh();select.dispatchEvent(new Event('change',{bubbles:true}));});menu.append(b);}
    trigger.addEventListener('click',()=>{const show=menu.hidden;menu.hidden=!show;trigger.setAttribute('aria-expanded',String(show));if(show)menu.firstElementChild.focus();});
    wrapper.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();close();trigger.focus();}if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();menu.hidden=false;trigger.setAttribute('aria-expanded','true');const items=[...menu.children];let n=items.indexOf(document.activeElement);n=e.key==='Home'?0:e.key==='End'?items.length-1:(n+(e.key==='ArrowUp'?-1:1)+items.length)%items.length;items[n].focus();}});
    wrapper.addEventListener('focusout',()=>setTimeout(()=>{if(!wrapper.contains(document.activeElement))close();},0));document.addEventListener('click',e=>{if(!wrapper.contains(e.target))close();});select.addEventListener('change',refresh);wrapper.append(trigger,menu);select.after(wrapper);refresh();
  }
  if(document.readyState!=='loading')decorate();
  document.addEventListener('DOMContentLoaded',decorate);document.addEventListener('mll:langswitch',decorate);
})();
