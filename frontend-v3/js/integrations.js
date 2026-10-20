/* Reviewed public frontend integrations for the local V3 presentation.
 * Sources: data.js, directory.html, business.html, jobs.html, marketplace.html,
 * voz.html, media.js and the status/auth portion of mll-ai.js in v2-dev.
 * No write, login, analytics, billing or AI search requests are included.
 */
(() => {
  'use strict';
  const page=document.body.dataset.page;
  const base=location.pathname.includes('/pages/')?'../':'';
  const {esc,webURL,imageURL,rating,sortBusinesses,searchRecords,hasNext}=MLL_VIEW;
  const spanish=document.documentElement.lang==='es';
  const tr=(en,es)=>spanish?es:en;
  // Staging stays anonymous. A token alone never makes this a verified session.
  async function syncAccountNavigation() {
    if(window.MLL_STAGING?.visualOnly)return;
    let token;try{token=sessionStorage.getItem('mll_token');}catch(_){return;}
    if(!token)return;
    try {
      const response=await fetch(window.MLL_CONFIG.API_URL+'/api/auth/me',{headers:{Authorization:'Bearer '+token},credentials:'omit',redirect:'error'});
      if(!response.ok)return;
      const data=await response.json();if(!data.user?.id)return;
      document.querySelectorAll('.account-link').forEach(anchor=>{anchor.href=base+'pages/dashboard.html';anchor.textContent=tr('Dashboard','Panel de control');});
    }catch(_){/* Keep the anonymous Login link on expiry or network failure. */}
  }
  const url=new URLSearchParams(location.search);
  const state={q:url.get('q')||'',city:url.has('city')?url.get('city'):(localStorage.getItem('mll_city')||''),category:url.get('category')||'',sort:url.get('sort')||'featured',page:1,rows:[],more:false,version:0,controller:null,loaded:false,type:url.get('type')||'',bilingual:url.get('bilingual')==='true'};
  // Nationwide selection applies only to businesses. Never inherit it into unsupported feeds.
  if(page==='jobs'||page==='marketplace'||page==='voz')state.city='';
  const categoryMap={Restaurants:'Food & Dining',Beauty:'Beauty & Salon',Fashion:'Retail','Home Services':'Construction',Health:'Health & Wellness',Entertainment:'Events',Tourism:'Tourism',Professionals:'Legal Services',More:'','All Categories':''};
  const categories=[['','All Categories','Todas las categorías'],['Food & Dining','Restaurants','Restaurantes'],['Beauty & Salon','Beauty','Belleza'],['Retail','Fashion & Retail','Moda y comercio'],['Construction','Home Services','Servicios del hogar'],['Health & Wellness','Health','Salud'],['Legal Services','Legal Services','Servicios legales'],['Finance','Finance','Finanzas'],['Real Estate','Real Estate','Bienes raíces'],['Auto & Repair','Auto & Repair','Autos y reparación'],['Education','Education','Educación'],['Tech','Technology','Tecnología'],['Events','Events','Eventos'],['Other','Other','Otros']];
  const productCategories=[['','All Categories','Todas las categorías'],['Food','Food & Dining','Comida'],['Beauty','Beauty','Belleza'],['Clothing','Clothing','Ropa'],['Art','Art & Crafts','Arte y artesanías'],['Home','Home & Garden','Hogar y jardín'],['Books','Books & Media','Libros y medios'],['Other','Other','Otros']];
  const resourceCategories=[['','All','Todos'],['finance','Finance','Finanzas'],['grants','Grants','Subvenciones'],['legal','Legal','Legal'],['tax','Tax','Impuestos'],['immigration','Immigration','Inmigración'],['licensing','Licensing','Licencias']];
  const label=value=>{const c=[...categories,...productCategories,...resourceCategories].find(item=>item[0]===value);return c?tr(c[1],c[2]):value;};
  const empty=(title,text)=>`<div class="empty"><h3>${title}</h3><p>${text}</p></div>`;
  const loading=()=>`<p class="loading" role="status">${tr('Loading…','Cargando…')}</p>`;
  const button=(href,text)=>href?`<a class="btn small" href="${esc(href)}" ${href.startsWith('https:')?'target="_blank" rel="noopener noreferrer"':''}>${text}</a>`:'';
  function photo(record,cls='photo') {
    const src=imageURL(record);
    return src?`<div class="${cls}"><img src="${esc(src)}" alt="${esc(record.name||'')}" loading="lazy" referrerpolicy="no-referrer"><span class="photo-missing" hidden>${tr('Photo unavailable','Foto no disponible')}</span></div>`:`<div class="${cls} no-photo">${tr('No photo provided','Sin foto disponible')}</div>`;
  }
  function score(record) {
    const value=rating(record);
    return value?`<span class="rating">★ ${value.score.toFixed(1)} <span class="muted">(${value.count})</span></span>`:'';
  }
  function businessCard(b) {
    const id=b.slug||b.id||'',href=base+'pages/business-detail.html?slug='+encodeURIComponent(id);
    const phone=String(b.phone||'').replace(/[^\d+]/g,'');
    let saved=false;
    try{const list=JSON.parse(localStorage.getItem('mll_saved')||'[]');saved=Array.isArray(list)&&list.includes(id);}catch(_){}
    return `<article class="card business-card"><div class="business-media"><a href="${href}" tabindex="-1" aria-hidden="true">${photo(b)}</a><button class="save-button ${saved?'is-saved':''}" data-save="${esc(id)}" aria-label="${tr('Save business','Guardar negocio')}" aria-pressed="${saved}">♡</button>${b.category?`<span class="photo-category">${esc(label(b.category))}</span>`:''}</div><div class="card-body"><h3><a href="${href}">${esc(b.name)}</a></h3>${score(b)}<p class="business-location">${esc([b.city,b.state].filter(Boolean).join(', '))}</p>${b.description?`<p class="business-description">${esc(b.description)}</p>`:''}<div class="card-actions">${phone?`<a href="tel:${esc(phone)}">${tr('Call','Llamar')}</a>`:''}<a class="profile-link" href="${href}">${tr('View business','Ver negocio')} →</a></div></div></article>`;
  }
  function jobCard(j) {
    const types={'Full-time':'Tiempo completo','Part-time':'Medio tiempo',Contract:'Por contrato',Seasonal:'Temporal',Internship:'Pasantía'};
    return `<article class="card job-card" ${j.id?'id="job-'+esc(j.id)+'"':''}><div class="job-symbol" aria-hidden="true">▤</div><div class="job-info"><h3>${esc(j.title)}</h3><p>${esc(j.company_name||'')}</p><p class="muted">${esc([j.city,j.state].filter(Boolean).join(', '))}</p>${j.bilingual_required===true?`<span class="tag">${tr('Bilingual','Bilingüe')}</span>`:''}</div><div class="job-terms">${j.job_type?`<span class="tag">${esc(spanish?(types[j.job_type]||j.job_type):j.job_type)}</span>`:''}${j.salary_range?`<p>${esc(j.salary_range)}</p>`:''}</div></article>`;
  }
  function productCard(p) {
    const price=p.price!=null&&p.price!==''&&Number.isFinite(Number(p.price))?new Intl.NumberFormat(spanish?'es-US':'en-US',{style:'currency',currency:'USD'}).format(Number(p.price)):'';
    return `<article class="card">${photo(p)}<div class="card-body"><h3>${esc(p.name)}</h3>${p.seller_name?`<p class="muted">${tr('by','por')} ${esc(p.seller_name)}</p>`:''}<div class="product-meta">${price?`<strong>${esc(price)}</strong>`:''}${score(p)}</div></div></article>`;
  }
  function resourceCard(r) {
    const href=webURL(r.url);
    return `<article class="card resource-card"><div class="card-body"><span class="tag">${esc(label(r.category||r.tag||''))}</span><h3>${esc(r.title)}</h3><p class="muted">${esc(r.description||'')}</p>${href?button(href,tr('View resource','Ver recurso')+' ↗'):''}${r.is_bilingual?'<span class="resource-language">EN / ES</span>':''}</div></article>`;
  }
  function render(container,rows,renderer) {
    container.innerHTML=rows.length?rows.map(renderer).join(''):empty(tr('No results found','No se encontraron resultados'),tr('Try adjusting your search or filters.','Prueba ajustando tu búsqueda o filtros.'));
    container.setAttribute('aria-busy','false');
  }
  function fail(container,error,retry) {
    container.innerHTML=empty(tr('Could not load this content','No pudimos cargar este contenido'),tr('The staging data service could not be reached. Please try again.','No se pudo acceder al servicio de datos de pruebas. Inténtalo de nuevo.'));
    container.setAttribute('aria-busy','false');
    const retryButton=document.createElement('button');retryButton.className='btn small';retryButton.textContent=tr('Retry','Reintentar');retryButton.addEventListener('click',retry);container.querySelector('.empty').append(retryButton);
    console.warn('MLL read request failed',{endpoint:error.endpoint,status:error.status,error:error.message});
  }
  function mountResults(node,id,cls='cards') {
    node.outerHTML=`<div class="${cls}" id="${id}" aria-live="polite" aria-busy="true">${loading()}</div>`;
    return document.getElementById(id);
  }
  async function homeBlock(container,fetcher,key,renderer) {
    try{const data=await fetcher();render(container,data[key].slice(0,3),renderer);}catch(error){fail(container,error,()=>homeBlock(container,fetcher,key,renderer));}
  }
  function chips(list) {
    return list.map(([value,en,es])=>`<button class="pill ${state.category===value?'active':''}" data-category="${esc(value)}" aria-pressed="${state.category===value}">${tr(en,es)}</button>`).join('');
  }
  let resultContainer=null,moreButton=null,summary=null;
  syncAccountNavigation();
  if(page==='home') {
    const placeholders=[...document.querySelectorAll('main .empty')];
    [[MLL_LOCATION.getBusinesses,'businesses',businessCard,'cards'],[MLL.getJobs,'jobs',jobCard,'jobs-list'],[MLL.getProducts,'products',productCard,'cards']].forEach(([fetcher,key,renderer,cls],index)=>{
      const node=mountResults(placeholders[index],'home-'+key,cls);homeBlock(node,()=>fetcher(key==='businesses'?{city:state.city}:undefined),key,renderer);
    });
    const resourceNode=mountResults(document.querySelector('.feature-art'),'home-resources','resource-preview');
    homeBlock(resourceNode,()=>MLL.getResources(),'resources',resourceCard);
    document.querySelectorAll('.category-rail a,.mini-row a').forEach((anchor,index)=>{
      const category=categoryMap[index<10?categoriesLabel(index):categoriesLabel(index-10)];
      if(index===8)return;
      anchor.href=base+'pages/businesses.html'+(category?'?category='+encodeURIComponent(category):'');
    });
  }
  function categoriesLabel(index){return ['Restaurants','Beauty','Fashion','Home Services','Health','Entertainment','Tourism','Professionals','Jobs','More'][index];}
  const searchForm=document.querySelector('#search-form');
  // Native city controls share persisted state; marketplace has no API city filter.
  if(page==='marketplace')searchForm?.elements.namedItem('city')?.remove();

  if(page==='businesses') {
    resultContainer=document.querySelector('.directory-results');
    document.querySelector('.filter-list').innerHTML=categories.map(([value,en,es])=>`<button data-category="${esc(value)}" class="${state.category===value?'selected':''}" aria-pressed="${state.category===value}">${tr(en,es)}</button>`).join('');
    document.querySelector('#category-pills').innerHTML=chips(categories.slice(0,7));
    document.querySelector('.directory .section-heading h2').textContent=tr('Business Directory','Directorio de negocios');
    document.querySelector('.directory .section-heading p').remove();
    const oldControls=document.querySelectorAll('.page-banner .pills')[1];
    oldControls.innerHTML=`<label class="sort-control">${tr('Sort loaded results','Ordenar resultados cargados')}<select class="pill" id="data-sort"><option value="featured">${tr('Featured first','Destacados primero')}</option><option value="az">${tr('Name: A–Z','Nombre: A–Z')}</option><option value="rating">${tr('Highest rated','Mejor calificados')}</option></select></label>`;
    const sort=document.querySelector('#data-sort');sort.value=state.sort;
    sort.addEventListener('change',()=>{state.sort=sort.value;syncURL();if(state.loaded)renderLoaded();});
  } else if(page==='jobs'||page==='marketplace'||page==='voz') {
    resultContainer=mountResults(document.querySelector('main .empty'),'data-results',page==='jobs'?'jobs-list':'cards');
    const controls=document.createElement('div');controls.className='pills data-controls';
    if(page==='jobs') {
      controls.innerHTML=`<label>${tr('Job type','Tipo de empleo')} <select class="pill" id="job-type"><option value="">${tr('All types','Todos los tipos')}</option>${[['Full-time','Tiempo completo'],['Part-time','Medio tiempo'],['Contract','Por contrato'],['Seasonal','Temporal'],['Internship','Pasantía']].map(([value,es])=>`<option value="${value}">${tr(value,es)}</option>`).join('')}</select></label><label class="checkbox-control"><input type="checkbox" id="bilingual"> ${tr('Bilingual filter unavailable','Filtro bilingüe no disponible')}</label>`;
    }else controls.innerHTML=chips(page==='marketplace'?productCategories:resourceCategories);
    const banner=document.querySelector('.page-banner .wrap');
    if(page==='voz')document.querySelector('.page-banner .pills').remove();
    banner.append(controls);
    if(page==='voz') {
      const form=document.createElement('form');form.id='resource-search';form.className='searchbar';form.setAttribute('role','search');
      form.innerHTML=`<input name="q" value="${esc(state.q)}" placeholder="${tr('Search resources…','Buscar recursos…')}" aria-label="${tr('Search resources','Buscar recursos')}"><button class="btn primary">${tr('Search','Buscar')}</button>`;
      banner.insertBefore(form,controls);
    }
    if(page==='jobs') {
      const type=document.querySelector('#job-type'),bilingual=document.querySelector('#bilingual');type.value=state.type;state.bilingual=false;bilingual.checked=false;bilingual.disabled=true;bilingual.title=tr('The existing jobs API does not return bilingual requirements.','El API de empleos no devuelve requisitos bilingües.');
      [type,bilingual].forEach(node=>node.addEventListener('change',()=>{state.type=type.value;state.bilingual=bilingual.checked;syncURL();if(state.loaded)renderLoaded();}));
    }
  }
  if(resultContainer) {
    summary=document.createElement('p');summary.className='muted results-summary';resultContainer.before(summary);
    resultContainer.setAttribute('aria-live','polite');
    if(page!=='voz') {
      moreButton=document.createElement('button');moreButton.className='btn load-more';moreButton.textContent=tr('Load more','Cargar más');moreButton.hidden=true;resultContainer.after(moreButton);moreButton.addEventListener('click',()=>loadCollection(true));
    }
    loadCollection();
  }
  function syncURL() {
    const query=new URLSearchParams();if(MLL_LOCATION.selected().state)query.set('state',MLL_LOCATION.selected().state);
    for(const key of ['q','city','category'])if(state[key])query.set(key,state[key]);
    if(page==='businesses'&&state.sort!=='featured')query.set('sort',state.sort);
    if(page==='jobs') {if(state.type)query.set('type',state.type);if(state.bilingual)query.set('bilingual','true');}
    history.replaceState(null,'',location.pathname+(query.size?'?'+query:''));
  }
  function renderLoaded() {
    let rows=state.rows;
    if(page==='businesses') rows=sortBusinesses(rows,state.sort);
    else {
      rows=searchRecords(rows,state.q,state.city,page==='jobs'?['title','company_name']:page==='marketplace'?['name','description','seller_name']:['title','description']);
      if(page==='jobs')rows=rows.filter(j=>(!state.type||j.job_type===state.type)&&(!state.bilingual||j.bilingual_required===true));
      if(page==='voz'&&state.category)rows=rows.filter(r=>r.category===state.category);
    }
    render(resultContainer,rows,page==='businesses'?businessCard:page==='jobs'?jobCard:page==='marketplace'?productCard:resourceCard);
    summary.textContent=page==='businesses'?tr('Business location matching uses API city search and exact city/state checks in your browser over fully fetched matches. Sort applies to loaded results.','La ubicación usa la búsqueda por ciudad del API y coincidencias exactas de ciudad/estado en tu navegador sobre todos los resultados recuperados. El orden se aplica a los resultados cargados.'):page==='voz'?'':tr('Search and filters apply to loaded results. Load more to browse further.','La búsqueda y los filtros se aplican a resultados cargados. Carga más para explorar.');
    if(moreButton){moreButton.hidden=!state.more;moreButton.disabled=false;}
    if(page==='jobs'&&url.get('id'))document.getElementById('job-'+url.get('id'))?.scrollIntoView({block:'center'});
  }
  async function loadCollection(append=false) {
    const version=++state.version;state.controller?.abort();state.controller=new AbortController();
    const options={signal:state.controller.signal};
    if(moreButton)moreButton.disabled=true;
    resultContainer.setAttribute('aria-busy','true');
    if(!append){state.rows=[];state.page=1;state.more=false;state.loaded=false;resultContainer.innerHTML=loading();if(moreButton)moreButton.hidden=true;}
    const nextPage=append?state.page+1:1;
    try {
      const data=page==='businesses'?await MLL_LOCATION.getBusinesses({q:state.q,city:state.city,category:state.category,page:nextPage},options):page==='jobs'?await MLL.getJobs({page:nextPage},options):page==='marketplace'?await MLL.getProducts({category:state.category,page:nextPage},options):await MLL.getResources(options);
      if(version!==state.version)return;
      const key=page==='businesses'?'businesses':page==='jobs'?'jobs':page==='marketplace'?'products':'resources';
      const rows=data[key].filter(row=>row&&typeof row==='object');
      const seen=new Set(state.rows.map(row=>row.id||row.slug));
      state.rows=append?[...state.rows,...rows.filter(row=>!seen.has(row.id||row.slug))]:rows;
      state.page=nextPage;state.more=hasNext({...data,businesses:rows},state.rows.length);state.loaded=true;
      renderLoaded();
    }catch(error){
      if(version!==state.version)return;
      if(append){
        resultContainer.setAttribute('aria-busy','false');
        resultContainer.querySelector('.load-error')?.remove();
        const notice=document.createElement('p');notice.className='load-error';notice.setAttribute('role','status');notice.textContent=tr('Could not load more results. Please retry.','No pudimos cargar más resultados. Inténtalo de nuevo.');resultContainer.append(notice);
        if(moreButton)moreButton.disabled=false;
      }else fail(resultContainer,error,()=>loadCollection());
    }
  }
  // Public search is a GET-only UI action, not a native form submission.
  // The original staging guard still rejects every native form submission.
  function performPublicSearch(form) {
    const data=new FormData(form);state.q=String(data.get('q')||'').trim();state.city=(page==='home'||page==='businesses')?MLL_LOCATION.selected().city:'';
    if(page==='home') {
      const query=new URLSearchParams();if(MLL_LOCATION.selected().state)query.set('state',MLL_LOCATION.selected().state);if(state.q)query.set('q',state.q);if(state.city)query.set('city',state.city);
      location.href=base+'pages/businesses.html'+(query.size?'?'+query:'');
    }else{syncURL();if(page==='businesses')loadCollection();else if(state.loaded)renderLoaded();}
  }
  document.querySelectorAll('#search-form,#resource-search').forEach(form=>{
    const searchButton=form.querySelector('button');
    searchButton.type='button';searchButton.addEventListener('click',()=>performPublicSearch(form));
    form.addEventListener('keydown',event=>{if(event.key==='Enter'&&event.target.tagName==='INPUT'){event.preventDefault();performPublicSearch(form);}});
  });
  document.addEventListener('click',event=>{
    const category=event.target.closest?.('[data-category]');
    if(category&&resultContainer) {
      event.preventDefault();event.stopImmediatePropagation();state.category=category.dataset.category;
      document.querySelectorAll('[data-category]').forEach(node=>{const on=node.dataset.category===state.category;node.classList.toggle(node.classList.contains('pill')?'active':'selected',on);node.setAttribute('aria-pressed',String(on));});
      syncURL();if(page==='voz'){if(state.loaded)renderLoaded();}else loadCollection();
    }
    const save=event.target.closest?.('[data-save]');
    if(save)try {
      let list=JSON.parse(localStorage.getItem('mll_saved')||'[]');if(!Array.isArray(list))list=[];
      const id=save.dataset.save,on=!list.includes(id);list=on?[...list,id]:list.filter(item=>item!==id);localStorage.setItem('mll_saved',JSON.stringify(list));save.classList.toggle('is-saved',on);save.setAttribute('aria-pressed',String(on));
    }catch(_){}
  },true);
  document.addEventListener('error',event=>{
    if(event.target.tagName!=='IMG')return;
    event.target.hidden=true;const notice=event.target.parentElement.querySelector('.photo-missing');
    if(notice){notice.hidden=false;event.target.parentElement.classList.add('no-photo');}
  },true);
  MLL_LOCATION.mount();

  function profileHTML(b) {
    const phone=String(b.phone||'').replace(/[^\d+]/g,'');
    const email=/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(b.email||'')?b.email:'';
    const website=webURL(b.website),address=[b.address,b.city,b.state,b.zip].filter(Boolean).join(', ');
    const directions=address?'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent([b.name,address].filter(Boolean).join(', ')):'';
    const hours=b.hours&&typeof b.hours==='object'&&!Array.isArray(b.hours)?Object.entries(b.hours).filter(([,value])=>typeof value==='string'):[];
    const days={mon:tr('Monday','Lunes'),tue:tr('Tuesday','Martes'),wed:tr('Wednesday','Miércoles'),thu:tr('Thursday','Jueves'),fri:tr('Friday','Viernes'),sat:tr('Saturday','Sábado'),sun:tr('Sunday','Domingo')};
    return `<div class="profile-cover">${photo(b,'profile-photo')}</div><div class="profile-title"><div>${b.category?`<span class="tag">${esc(label(b.category))}</span>`:''}<h1>${esc(b.name)}</h1>${score(b)}<p class="muted">${esc([b.city,b.state].filter(Boolean).join(', '))}</p></div><div class="profile-actions">${button(phone?'tel:'+phone:'',tr('Call','Llamar'))}${button(email?'mailto:'+email:'',tr('Message','Mensaje'))}${button(website,tr('Website','Sitio web'))}${button(directions,tr('Directions','Cómo llegar'))}</div></div><nav class="profile-tabs" aria-label="${tr('Business information','Información del negocio')}"><a href="#profile-about">${tr('Overview','Información')}</a><a href="#profile-photos">${tr('Photos','Fotos')}</a><a href="#profile-hours">${tr('Hours','Horario')}</a></nav><div class="profile-columns"><div><section class="form-card" id="profile-about"><h2>${tr('About this business','Acerca del negocio')}</h2><p>${esc(b.description||tr('No description provided.','No hay descripción disponible.'))}</p>${Array.isArray(b.tags)?`<div class="pills">${b.tags.filter(tag=>typeof tag==='string').map(tag=>`<span class="tag">${esc(tag)}</span>`).join('')}</div>`:''}</section><section class="form-card" id="profile-photos"><h2>${tr('Photos','Fotos')}</h2>${photo(b)}</section></div><aside><section class="form-card"><h2>${tr('Contact & Location','Contacto y ubicación')}</h2>${address?`<p>${esc(address)}</p>`:''}${button(phone?'tel:'+phone:'',esc(b.phone||''))}${button(email?'mailto:'+email:'',esc(email))}${button(website,tr('Visit website','Visitar sitio web'))}${button(directions,tr('Get directions','Cómo llegar'))}${!address&&!phone&&!email&&!website?`<p class="muted">${tr('Contact details not provided.','No hay datos de contacto disponibles.')}</p>`:''}</section><section class="form-card" id="profile-hours"><h2>${tr('Business Hours','Horario de atención')}</h2>${hours.length?`<dl class="hours-list">${hours.map(([key,value])=>`<dt>${esc(days[key]||key)}</dt><dd>${esc(value)}</dd>`).join('')}</dl>`:`<p class="muted">${tr('Hours not provided.','Horario no disponible.')}</p>`}</section></aside></div>`;
  }
  if(page==='detail') {
    document.querySelector('main').innerHTML=`<section class="section soft"><div class="wrap"><a class="back-link" href="${base}pages/businesses.html">← ${tr('Back to directory','Volver al directorio')}</a><div id="business-profile" aria-live="polite" aria-busy="true">${loading()}</div></div></section>`;
    loadProfile();
  }
  async function loadProfile() {
    const container=document.querySelector('#business-profile'),identifier=url.get('slug')||url.get('id');
    if(!identifier){container.innerHTML=empty(tr('No business selected','No se ha seleccionado un negocio'),tr('Open a business from the directory to view its profile.','Abre un negocio del directorio para ver su perfil.'));container.setAttribute('aria-busy','false');return;}
    container.innerHTML=loading();
    try {
      const data=await MLL.getBusiness(identifier);
      if(!data.business||typeof data.business!=='object'||!data.business.name)throw new Error('Missing business profile.');
      container.innerHTML=profileHTML(data.business);container.setAttribute('aria-busy','false');document.title=data.business.name+' | My Latino List';
    }catch(error){fail(container,error,loadProfile);}
  }
  document.querySelector('.hero-actions .btn.outline')?.setAttribute('href',base+'pages/enroll.html');
  const platformLinks=document.querySelectorAll('.footer-grid > div')[1];
  if(platformLinks)for(const [route,en,es] of [['login','Sign in','Iniciar sesión'],['dashboard','Business dashboard','Panel de negocios'],['pricing','Plans','Planes']]) {
    const anchor=document.createElement('a');anchor.href=base+'pages/'+route+'.html';anchor.textContent=tr(en,es);platformLinks.append(anchor);
  }
  if(page==='partners') {
    const wrap=document.querySelector('main .section .wrap');
    if(wrap){const anchor=document.createElement('a');anchor.className='btn small';anchor.href=base+'pages/partner-programs.html';anchor.textContent=tr('Explore partner programs','Explorar programas de aliados');wrap.append(anchor);}
  }
  // Restore the original user-initiated video player and authentic local posters.
  if(page==='home') {
    const videos=document.querySelector('a[href*="mll-business-promo-final.mp4"]')?.closest('.section');
    if(videos)videos.outerHTML='<section id="mll-community-connect" class="mll-community-connect"></section>';
  }
  // Restore only the reviewed GET status handshake from mll-ai.js.
  // The original POST /api/ai/search is deliberately absent, including prompt chips.
  const chatContent=document.querySelector('.chat-content');
  chatContent.querySelector('.chat-bubble').textContent=tr('Hi! I’m MLL AI. Find Latino-owned businesses, jobs and La Voz Latino resources.','¡Hola! Soy MLL AI. Encuentra negocios latinos, empleos y recursos de La Voz Latino.');
  const chatStatus=document.createElement('p');chatStatus.id='ai-service-status';chatStatus.setAttribute('role','status');chatStatus.textContent=tr('Messaging is disabled in this local preview.','Los mensajes están deshabilitados en esta vista local.');chatContent.querySelector('.chat-bubble').after(chatStatus);
  chatContent.querySelector('.legal-note').textContent=tr('No AI messages are sent. Use regular directory search while verification is pending.','No se envían mensajes a la IA. Usa la búsqueda del directorio mientras se verifica la integración.');
  let checkedStatus=false;
  document.querySelector('#chat-open').addEventListener('click',async()=>{
    if(checkedStatus||!document.querySelector('#chat-panel').classList.contains('open'))return;
    checkedStatus=true;chatStatus.textContent=tr('Checking service availability…','Consultando disponibilidad…');
    try{const data=await MLL.getAIStatus();chatStatus.textContent=data.enabled?tr('Service status received. Messaging remains disabled pending verification and approval.','Estado del servicio recibido. Los mensajes siguen deshabilitados hasta verificar y aprobar la integración.'):tr('MLL AI is currently unavailable. Messaging remains disabled.','MLL AI no está disponible. Los mensajes siguen deshabilitados.');}
    catch(_){chatStatus.textContent=tr('Could not verify the AI service. Messaging remains disabled.','No se pudo verificar el servicio de IA. Los mensajes siguen deshabilitados.');}
  });
})();
