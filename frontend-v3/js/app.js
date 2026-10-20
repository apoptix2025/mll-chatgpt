try { if (!localStorage.getItem('mll_lang') && localStorage.getItem('mll-demo-lang')) localStorage.setItem('mll_lang',localStorage.getItem('mll-demo-lang')); } catch (_) {}
const routes={home:'index.html',businesses:'pages/businesses.html',detail:'pages/business-detail.html',jobs:'pages/jobs.html',marketplace:'pages/marketplace.html',voz:'pages/la-voz-latino.html',contact:'pages/contact.html',partners:'pages/partners.html'};
const inPages=location.pathname.includes('/pages/');const root=inPages?'../':'';const link=k=>root+routes[k];const categories=[['🍴','Restaurants','#ff862a'],['✂','Beauty','#f32783'],['🛍','Fashion','#9539e7'],['⌂','Home Services','#008fe8'],['♥','Health','#1ec36a'],['♫','Entertainment','#f84054'],['☀','Tourism','#ffb526'],['▣','Professionals','#0bb4c8'],['▤','Jobs','#517cd5'],['▦','More','#526d91']];
const app=document.querySelector('#app');const page=document.body.dataset.page||'home';let lang=localStorage.getItem('mll_lang')||'en';const tr=(en,es)=>lang==='es'?es:en;
function brand(){return `<a class="brand" href="${link('home')}"><img class="mll-official-logo" src="/assets/mll-v3-official-logo.png" width="221" height="48" alt="My Latino List — Connect • Support • Grow"></a>`}
function header(){return `<header class="site-header"><div class="wrap nav">${brand()}<button class="mobile-menu" aria-label="Toggle navigation" id="menu" aria-controls="navlinks" aria-expanded="false">☰</button><nav class="nav-links" id="navlinks"><a href="${link('home')}">${tr('Home','Inicio')}</a><a href="${link('businesses')}">${tr('Businesses','Negocios')}</a><a href="${link('jobs')}">${tr('Jobs','Empleos')}</a><a href="${link('marketplace')}">Marketplace</a><a href="${link('voz')}">La Voz Latino</a><a href="${link('partners')}">${tr('Partners','Aliados')}</a><a href="${link('contact')}">${tr('Contact','Contacto')}</a></nav><div class="nav-tools"><select id="location" aria-label="Location"><option value="">${tr('All locations','Todas las ciudades')}</option></select><select id="lang" aria-label="Language"><option value="en" ${lang==='en'?'selected':''}>🇺🇸 EN</option><option value="es" ${lang==='es'?'selected':''}>🇪🇸 ES</option></select>${accountNavigation()}</div></div></header>`}
function accountNavigation(){return `<a class="btn primary small account-link" href="${root}pages/login.html">${tr('Login','Iniciar sesión')}</a>`}
function footer(){return `<footer class="footer"><div class="wrap footer-grid"><div>${brand()}<p class="muted">${tr('Connect. Support. Grow.','Conecta. Apoya. Crece.')}</p></div><div><b>Platform</b><a href="${link('businesses')}">Business directory</a><a href="${link('marketplace')}">Marketplace</a><a href="${link('jobs')}">Jobs</a></div><div><b>For Businesses</b><a href="${link('contact')}">List your business</a><a href="${link('partners')}">Partners</a></div><div><b>Community</b><a href="${link('voz')}">La Voz Latino</a><a href="${link('contact')}">Contact</a></div><div><b>My Latino List</b><p>© 2026</p><p class="legal-note">Local V3 frontend preview</p></div></div></footer>`}
function chat(){return `<button class="chat-launch" id="chat-open" aria-controls="chat-panel" aria-expanded="false">✨ Ask MLL AI</button><section class="chat-panel" id="chat-panel" aria-label="MLL AI chat"><div class="chat-head">✨ Ask MLL AI <button style="float:right;color:white;background:none;border:0" id="chat-close" aria-label="Close chat">✕</button></div><div class="chat-content"><div class="chat-bubble">${tr('Welcome! The existing MLL AI backend has not been connected to this standalone preview.','¡Bienvenido! El backend de MLL AI no está conectado a esta vista local.')}</div><label class="field">${tr('Message','Mensaje')}<textarea id="chat-message" placeholder="Ask MLL AI..." disabled></textarea></label><button class="btn primary" disabled>${tr('Send','Enviar')}</button><p class="legal-note">${tr('Chat is display-only until the existing integration is safely ported.','Chat de demostración hasta integrar el servicio existente.')}</p></div></section>`}
function searchbar(){return `<form class="searchbar" id="search-form"><input name="q" placeholder="${tr('Search businesses, services or products...','Buscar negocios, servicios o productos...')}" aria-label="Search"><select name="city" aria-label="City"><option value="">${tr('All locations','Todas las ciudades')}</option></select><button class="btn primary" type="submit">${tr('Search','Buscar')}</button></form>`}
function empty(title,description){return `<div class="empty"><h3>${title}</h3><p>${description}</p><p class="legal-note">${tr('No sample business records or statistics are fabricated in this local preview.','Esta vista local no inventa negocios ni estadísticas.')}</p></div>`}
function section(title,subtitle,content,cta='',target='businesses'){return `<section class="section"><div class="wrap"><div class="section-heading"><div><h2>${title}</h2><p class="muted">${subtitle}</p></div>${cta?`<a class="btn small" href="${link(target)}">${cta} →</a>`:''}</div>${content}</div></section>`}
function homepage(){return `<section class="hero"><div class="wrap"><div class="hero-content"><h1>${tr('Discover','Descubre')}<br><span>${tr('Latino Businesses.','Negocios Latinos.')}</span><br>${tr('Strengthen Our','Fortalece Nuestra')}<br><span>${tr('Community.','Comunidad.')}</span></h1><p>${tr('Find what you need. Support local talent. Grow together.','Encuentra lo que buscas. Apoya el talento local. Crezcamos juntos.')}</p>${searchbar()}<div class="hero-actions"><a class="btn primary" href="${link('businesses')}">${tr('Explore Businesses','Explorar Negocios')} →</a><a class="btn outline" href="${link('contact')}">＋ ${tr('List Your Business','Publica tu Negocio')}</a></div></div><div class="category-rail">${categories.map(([icon,name,color])=>`<a href="${link(name==='Jobs'?'jobs':'businesses')}" class="category-tile"><span class="glyph" style="background:${color}">${icon}</span>${name}</a>`).join('')}</div></div></section>${section(tr('Featured Latino Businesses','Negocios Latinos Destacados'),tr('Discover businesses in your community.','Descubre negocios en tu comunidad.'),empty(tr('Businesses will appear here','Los negocios aparecerán aquí'),tr('Connect the existing business directory API to display verified listings.','Conecta el API existente para mostrar negocios reales.')),tr('View businesses','Ver negocios'))}<section class="section soft"><div class="wrap"><div class="mini-row">${[['🍴','Restaurants'],['💇','Beauty & Salons'],['🛍','Fashion & Boutiques'],['🛠','Home & Construction']].map(([emoji,t])=>`<a class="card compact-card" href="${link('businesses')}"><div class="glyph">${emoji}</div><h3>${t}</h3><span class="tag">Explore category →</span></a>`).join('')}</div></div></section>${section('Jobs & Opportunities',tr('Find opportunities in the Latino community.','Encuentra oportunidades en nuestra comunidad.'),empty('Job listings','Existing jobs integration is not configured in this standalone preview.'),'Explore jobs','jobs')}${section('Latino Marketplace',tr('Shop and support Latino-owned businesses.','Compra y apoya a negocios latinos.'),empty('Marketplace listings','Existing marketplace integration is not configured in this standalone preview.'),'Browse marketplace','marketplace')}<section class="section soft"><div class="wrap feature-split"><div><div class="badge">LA VOZ LATINO</div><h2>Built for our community.<br>By our community.</h2><p class="muted">News, resources and opportunities for Latino entrepreneurs.</p><a class="btn primary" href="${link('voz')}">Explore La Voz Latino →</a></div><div class="feature-art">🌎</div></div></section><section id="mll-community-connect" class="mll-community-connect"></section>${section('Get in touch','We’re here to help Latino business owners succeed.',`<div class="center"><a class="btn primary" href="${link('contact')}">Contact My Latino List →</a></div>`)}`}
function directory(){return `<section class="page-banner"><div class="wrap page-heading"><h1>${tr('Browse Latino Businesses','Explora Negocios Latinos')}</h1><p>${tr('Find trusted Latino-owned businesses near you.','Encuentra negocios latinos cerca de ti.')}</p>${searchbar()}<div class="pills" id="category-pills">${['All Categories','Restaurants','Beauty','Fashion','Home Services','Health','Professionals','More'].map((x,i)=>`<button class="pill ${i===0?'active':''}" data-category="${x}">${x}</button>`).join('')}</div><div class="pills"><select class="pill" aria-label="Neighborhood"><option>All neighborhoods</option></select><select class="pill" aria-label="Sort"><option>Sort by: Featured</option><option>Sort by: Name</option></select></div></div></section><section class="section soft"><div class="wrap directory"><aside class="sidebar"><h3>Categories</h3><div class="filter-list">${categories.map(([icon,n])=>`<button data-category="${n}">${icon} ${n}</button>`).join('')}</div></aside><div><div class="section-heading"><div><h2>Featured Businesses</h2><p class="muted">Explore Latino-owned businesses by category.</p></div></div><div class="directory-results" aria-live="polite">${empty(tr('Business listings are not available yet','Los negocios aún no están disponibles'),tr('The business directory is not connected in this local preview.','El directorio de negocios no está conectado en esta vista local.'))}</div></div></div></section>`}
function detail(){return `<section class="page-banner"><div class="wrap"><h1>Business Details</h1><p class="muted">Business profiles will use the V3 photo gallery, actions, tabs, and information layout.</p></div></section>${section('Business profile', 'Open a real listing from the connected directory.',empty('No business selected','This preview does not invent business profiles or reviews.'))}`}
function jobs(){return `<section class="page-banner"><div class="wrap page-heading"><h1>Find Jobs & Opportunities</h1><p>Discover career opportunities with Latino-owned businesses.</p>${searchbar()}<div class="pills"><button class="pill active">Jobs</button><a class="pill" href="${link('marketplace')}">Marketplace</a></div></div></section>${section('Available Opportunities','Explore openings by role and category.',empty('No jobs loaded','Connect your existing jobs API to display current openings.'))}`}
function marketplace(){return `<section class="page-banner"><div class="wrap page-heading"><h1>Latino Marketplace</h1><p>Shop from Latino-owned businesses.</p>${searchbar()}</div></section>${section('Explore Products','Discover products from our community.',empty('No products loaded','Connect your existing marketplace API to display current products.'))}`}
function voz(){return `<section class="page-banner"><div class="wrap page-heading"><h1>La Voz Latino</h1><p>News, resources, stories and opportunities for our community.</p><div class="pills">${['All','Community','Business Tips','Immigration','Events'].map((x,i)=>`<button class="pill ${i===0?'active':''}" data-category="${x}">${x}</button>`).join('')}</div></div></section>${section('Community News & Resources','Real articles will appear when the existing feed is connected.',empty('No articles loaded','This standalone preview does not include fabricated stories.'))}`}
function partners(){return `<section class="page-banner"><div class="wrap page-heading"><h1>Community Partners</h1><p>Grow opportunities together.</p></div></section>${section('Partner with My Latino List','Connect, support and grow.',`<div class="feature-split"><div><h2>Let’s build stronger communities.</h2><p class="muted">Get in touch to explore partnerships.</p><a class="btn primary" href="${link('contact')}">Contact partnerships →</a></div><div class="feature-art">🤝</div></div>`)}`}
function contact(){return `<section class="section soft"><div class="wrap"><div class="center" style="margin-bottom:28px"><div class="badge">CONTACT US</div><h2 style="font-size:38px;margin:8px 0">Get in touch</h2><p class="muted">Have questions? We're here to help Latino business owners<br>succeed.</p></div><div class="two-col" style="max-width:960px;margin:auto"><div class="contact-list">${[['📧','GENERAL','info@mylatinolist.io'],['📞','PHONE','202-812-1108'],['💬','SUPPORT','support@mylatinolist.io'],['🤝','PARTNERSHIPS','partners@mylatinolist.io'],['💳','BILLING & PAYMENTS','billing@mylatinolist.io']].map(([icon,t,v])=>`<div class="contact-item"><span class="emoji">${icon}</span><div><strong>${t}</strong>${v.includes('@')?`<a href="mailto:${v}">${v}</a>`:`<a href="tel:+1${v.replaceAll('-','')}">${v}</a>`}</div></div>`).join('')}</div><div class="form-card"><h2 style="font-size:23px">Send us a message</h2><form id="contact-form"><label class="field">Your name<input required placeholder="Maria Gonzalez"></label><label class="field">Email address<input required type="email" placeholder="you@example.com"></label><label class="field">Message<textarea required placeholder="Tell us how we can help..."></textarea></label><button class="btn primary" type="submit">Send message</button><p class="legal-note" id="contact-status">Standalone preview: submission is disabled until the existing secure contact handler is connected.</p></form></div></div></div></section>`}
document.documentElement.lang=lang;
app.innerHTML=header()+'<main id="main-content">'+({home:homepage,businesses:directory,detail,jobs,marketplace,voz,partners,contact}[page]||homepage)()+'</main>'+footer()+chat();

const params = new URLSearchParams(location.search);
const searchForm = document.querySelector('#search-form');
const queryInput = searchForm?.elements.namedItem('q');
const cityInput = searchForm?.elements.namedItem('city');
if (queryInput) queryInput.value = params.get('q') || '';
if (cityInput) cityInput.value = params.get('city') || '';
const currentRoute = routes[page];
document.querySelectorAll('.nav-links a').forEach(a => {
  if (a.getAttribute('href') === root + currentRoute) a.setAttribute('aria-current','page');
});
const menu = document.querySelector('#menu');
menu?.addEventListener('click', () => {
  const open = document.querySelector('#navlinks').classList.toggle('open');
  menu.setAttribute('aria-expanded', String(open));
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelector('#navlinks').classList.remove('open');
    menu.setAttribute('aria-expanded','false');
    if (document.querySelector('#chat-panel').classList.contains('open')) closeChat();
  }
});
document.querySelector('#lang')?.addEventListener('change',e=>{
  localStorage.setItem('mll_lang',e.target.value);
  location.reload();
});
searchForm?.addEventListener('submit', e => {
  e.preventDefault();
  const values = new FormData(searchForm);
  const target = new URLSearchParams();
  for (const key of ['q','city']) if (values.get(key)) target.set(key, values.get(key));
  if (page !== 'businesses') {
    location.href = link('businesses') + (target.size ? '?' + target.toString() : '');
    return;
  }
  history.replaceState(null,'',location.pathname + (target.size ? '?' + target.toString() : ''));
  const message = document.querySelector('.directory-results .empty p');
  message.textContent = tr('Search is unavailable because the local directory is not connected.','La búsqueda no está disponible porque el directorio local no está conectado.');
});
document.querySelectorAll('[data-category]').forEach(el => el.addEventListener('click', () => {
  document.querySelectorAll('[data-category]').forEach(x => {
    const selected = x.dataset.category === el.dataset.category;
    x.classList.toggle(x.classList.contains('pill') ? 'active' : 'selected', selected);
    x.setAttribute('aria-pressed', String(selected));
  });
}));
const chatPanel = document.querySelector('#chat-panel');
const chatLaunch = document.querySelector('#chat-open');
function closeChat() {
  chatPanel.classList.remove('open');
  chatLaunch.setAttribute('aria-expanded','false');
  chatLaunch.focus();
}
chatLaunch.addEventListener('click', () => {
  const open = chatPanel.classList.toggle('open');
  chatLaunch.setAttribute('aria-expanded', String(open));
  if (open) document.querySelector('#chat-close').focus();
});
document.querySelector('#chat-close').addEventListener('click',closeChat);
document.querySelector('#contact-form')?.addEventListener('submit',e=>{
  e.preventDefault();
  document.querySelector('#contact-status').textContent=tr('Message not sent: the contact service is not connected in this local preview.','Mensaje no enviado: el servicio de contacto no está conectado en esta vista local.');
});
