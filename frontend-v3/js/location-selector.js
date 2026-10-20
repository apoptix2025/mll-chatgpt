/* Nationwide geography is independent of listing coverage. No new API parameters or writes. */
(() => {
  'use strict';
  const geo=window.MLL_US_GEOGRAPHY, norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
  const tr=(en,es)=>document.documentElement.lang==='es'?es:en;
  const params=new URLSearchParams(location.search);
  let selected={state:params.has('state')?params.get('state'):(localStorage.getItem('mll_state')||''),city:params.has('city')?params.get('city'):(localStorage.getItem('mll_city')||'')};
  if(!geo.states.some(s=>s.code===selected.state))selected.state='';
  function persist(){localStorage.setItem('mll_state',selected.state);localStorage.setItem('mll_city',selected.city);}
  persist();
  const canonicalState=value=>geo.states.find(s=>norm(s.code)===norm(value)||norm(s.name)===norm(value))?.code||'';
  const matches=(row,place=selected)=>(!place.state||canonicalState(row.state)===place.state)&&(!place.city||norm(row.city)===norm(place.city));
  async function allBusinesses(filters={},options){
    const rows=[];let last;
    for(let page=1;page<=1000;page++){
      last=await MLL.getBusinesses({...filters,page},options);rows.push(...last.businesses);
      if(!MLL_VIEW.hasNext(last,rows.length))return rows;
      if(!last.businesses.length)throw Error('Incomplete business pagination');
    }
    throw Error('Business pagination limit; cannot claim complete results');
  }
  async function getBusinesses(filters={},options){
    const place={...selected};
    if(!place.state&&!place.city)return MLL.getBusinesses(filters,options);
    const rows=(await allBusinesses({...filters,city:place.city},options)).filter(row=>matches(row,place));
    const page=filters.page||1,limit=12;
    return{businesses:rows.slice((page-1)*limit,page*limit),total:rows.length,page,limit};
  }
  let inventory,inventoryPromise,dialog,draft,refreshCities,refreshStates;
  function label(place=selected){return [place.city,place.state].filter(Boolean).join(', ')||tr('All states · All cities','Todos los estados · Todas las ciudades');}
  function updateLabels(){document.querySelectorAll('.location-trigger').forEach(b=>b.textContent=label());document.querySelectorAll('input[name="city"]').forEach(i=>i.value=selected.city);}
  function count(state,city){if(!inventory)return tr('Listings not checked','Anuncios sin verificar');const n=inventory.filter(r=>matches(r,{state,city})).length;return n+' '+tr('business listings','anuncios de negocios');}
  function combo(container,id,title,choices,onChoose){
    const label=document.createElement('label');label.textContent=title;label.htmlFor=id;
    const input=document.createElement('input');input.id=id;input.type='search';input.autocomplete='off';input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-expanded','true');input.setAttribute('aria-controls',id+'-results');
    const list=document.createElement('div');list.id=id+'-results';list.className='location-options';list.setAttribute('role','listbox');list.setAttribute('aria-label',title);
    const status=document.createElement('p');status.className='location-hint';status.setAttribute('role','status');container.append(label,input,list,status);
    let active=-1,items=[];
    function choose(index){if(!items[index])return;onChoose(items[index]);input.value='';active=-1;render();}
    function activate(index){active=index;[...list.children].forEach((b,i)=>b.setAttribute('aria-selected',String(i===active)));if(list.children[active]){input.setAttribute('aria-activedescendant',list.children[active].id);list.children[active].scrollIntoView({block:'nearest'});}else input.removeAttribute('aria-activedescendant');}
    function render(){
      const all=choices().filter(x=>norm(x.label).includes(norm(input.value)));items=all.slice(0,60);list.replaceChildren();input.removeAttribute('aria-activedescendant');active=-1;
      items.forEach((item,index)=>{const b=document.createElement('button');b.type='button';b.tabIndex=-1;b.id=id+'-option-'+index;b.setAttribute('role','option');b.setAttribute('aria-selected','false');b.textContent=item.label;b.addEventListener('click',()=>choose(index));list.append(b);});
      status.textContent=all.length>60?tr('Showing 60 matches. Keep typing to narrow the list.','Se muestran 60 coincidencias. Escribe más para reducir la lista.'):all.length?all.length+' '+tr('choices','opciones'):tr('No geographic matches.','No hay coincidencias geográficas.');
    }
    input.addEventListener('input',render);input.addEventListener('keydown',e=>{
      if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();activate(Math.max(0,Math.min(items.length-1,active+(e.key==='ArrowDown'?1:-1))));}
      if(e.key==='Enter'){e.preventDefault();choose(active<0?0:active);}
    });render();return{input,render,status};
  }
  function open(){
    if(dialog){dialog.remove();}draft={...selected};dialog=document.createElement('dialog');dialog.className='location-dialog';dialog.setAttribute('aria-labelledby','location-title');
    const title=document.createElement('h2');title.id='location-title';title.textContent=tr('Choose your location','Elige tu ubicación');
    const intro=document.createElement('p');intro.textContent=tr('U.S. Census places are geographic choices, not a promise of business listings.','Los lugares del Censo son opciones geográficas, no una promesa de anuncios.');
    const current=document.createElement('p');current.className='location-current';current.setAttribute('aria-live','polite');
    const grid=document.createElement('div');grid.className='location-grid';const left=document.createElement('div'),right=document.createElement('div');grid.append(left,right);
    const actions=document.createElement('div');actions.className='location-actions';const cancel=document.createElement('button');cancel.type='button';cancel.textContent=tr('Cancel','Cancelar');cancel.addEventListener('click',()=>dialog.close());
    const apply=document.createElement('button');apply.type='button';apply.className='btn primary';apply.textContent=tr('Show businesses','Ver negocios');
    const disclaimer=document.createElement('p');disclaimer.className='location-hint';disclaimer.textContent=tr('Applies to business listings only. Jobs and marketplace are not filtered by this location.','Solo se aplica a anuncios de negocios. Los empleos y el mercado no se filtran por esta ubicación.');
    actions.append(cancel,apply);dialog.append(title,intro,current,grid,disclaimer,actions);document.body.append(dialog);
    function updateDraft(){current.textContent=label(draft);cityCombo.input.disabled=!draft.state;cityCombo.render();if(!draft.state)cityCombo.status.textContent=tr('Choose a state first.','Elige un estado primero.');}
    const stateCombo=combo(left,'location-state',tr('1. Search state','1. Buscar estado'),()=>[{value:'',label:tr('All states','Todos los estados')},...geo.states.map(s=>({value:s.code,label:s.name+' ('+s.code+')'}))],item=>{draft.state=item.value;draft.city='';updateDraft();if(draft.state)cityCombo.input.focus();});
    const cityCombo=combo(right,'location-city',tr('2. Search city / Census place','2. Buscar ciudad / lugar del Censo'),()=>draft.state?[{value:'',label:tr('All cities','Todas las ciudades')},...geo.places[draft.state].map(p=>({value:p[1],label:p[0]+' — '+count(draft.state,p[1])}))]:[],item=>{draft.city=item.value;updateDraft();});
    refreshCities=cityCombo.render;refreshStates=stateCombo.render;updateDraft();
    apply.addEventListener('click',()=>{selected={...draft};persist();updateLabels();const query=new URLSearchParams();if(selected.state)query.set('state',selected.state);if(selected.city)query.set('city',selected.city);dialog.close();location.href='/pages/businesses'+(query.size?'?'+query:'');});
    dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
    // Search inputs otherwise consume the first Escape to clear their native search text.
    dialog.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();dialog.close();}});
    dialog.showModal();stateCombo.input.focus();
    if(!inventoryPromise)inventoryPromise=allBusinesses().then(rows=>{inventory=rows;return rows;}).catch(()=>{inventoryPromise=null;});
    inventoryPromise.then(()=>{if(dialog.open){refreshCities();refreshStates();}});
  }
  function mount(){
    const header=document.querySelector('#location');if(header){const b=document.createElement('button');b.type='button';b.id='location';b.className='location-trigger';b.setAttribute('aria-haspopup','dialog');b.setAttribute('aria-label',tr('Choose state and city','Elegir estado y ciudad'));header.replaceWith(b);b.addEventListener('click',open);}
    const city=document.querySelector('#search-form [name="city"]');if(city){const hidden=document.createElement('input');hidden.type='hidden';hidden.name='city';city.replaceWith(hidden);const b=document.createElement('button');b.type='button';b.className='location-trigger search-location';b.setAttribute('aria-haspopup','dialog');b.addEventListener('click',open);hidden.after(b);}
    if(['jobs','marketplace'].includes(document.body.dataset.page)){const note=document.createElement('p');note.className='muted';note.textContent=tr('State/city selection applies to the business directory. These results are not geographically filtered.','La selección de estado/ciudad se aplica al directorio de negocios. Estos resultados no se filtran geográficamente.');document.querySelector('.page-banner .wrap')?.append(note);}
    updateLabels();
  }
  window.MLL_LOCATION=Object.freeze({mount,open,getBusinesses,selected:()=>({...selected}),matches,canonicalState});
})();
