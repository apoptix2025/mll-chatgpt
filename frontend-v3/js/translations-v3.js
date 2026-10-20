/* Supplemental V3 presentation labels using the original mll_lang preference.
 * Applied only to initial static UI, before any business/API records are rendered.
 */
(() => {
  const translations={
    'Platform':'Plataforma','Business directory':'Directorio de negocios','For Businesses':'Para negocios',
    'List your business':'Publica tu negocio','Community':'Comunidad','My Latino List':'My Latino List',
    'Local V3 frontend preview':'Vista local V3','Jobs':'Empleos','Marketplace':'Mercado','Partners':'Aliados','Contact':'Contacto',
    'Restaurants':'Restaurantes','Beauty':'Belleza','Fashion':'Moda','Home Services':'Servicios del hogar',
    'Health':'Salud','Entertainment':'Entretenimiento','Tourism':'Turismo','Professionals':'Profesionales','More':'Más',
    'Restaurants →':'Restaurantes →','Beauty & Salons':'Belleza y salones','Fashion & Boutiques':'Moda y boutiques',
    'Home & Construction':'Hogar y construcción','Explore category →':'Explorar categoría →',
    'Featured Latino Businesses':'Negocios latinos destacados','View businesses':'Ver negocios',
    'Jobs & Opportunities':'Empleos y oportunidades','Job listings':'Ofertas de empleo',
    'Existing jobs integration is not configured in this standalone preview.':'La integración de empleos no está configurada en esta vista local.',
    'Explore jobs':'Explorar empleos','Explore jobs →':'Explorar empleos →','Latino Marketplace':'Mercado Latino',
    'Marketplace listings':'Productos del mercado','Browse marketplace':'Explorar mercado','Browse marketplace →':'Explorar mercado →',
    'Built for our community.':'Creado para nuestra comunidad.','By our community.':'Por nuestra comunidad.',
    'News, resources and opportunities for Latino entrepreneurs.':'Noticias, recursos y oportunidades para emprendedores latinos.',
    'Explore La Voz Latino →':'Explora La Voz Latino →','Community Stories & Videos':'Historias y videos de la comunidad',
    'Support the people behind Latino businesses.':'Apoya a las personas detrás de los negocios latinos.',
    'Business owners':'Dueños de negocios','Salons & Barbershops':'Salones y barberías',
    'Watch the existing My Latino List community video.':'Mira el video de la comunidad de My Latino List.',
    'Open video ↗':'Abrir video ↗','Get in touch':'Ponte en contacto',
    'We’re here to help Latino business owners succeed.':'Estamos aquí para ayudar a los dueños de negocios latinos.',
    'Contact My Latino List →':'Contacta a My Latino List →','Categories':'Categorías',
    'Find Jobs & Opportunities':'Encuentra empleos y oportunidades',
    'Discover career opportunities with Latino-owned businesses.':'Descubre oportunidades con negocios latinos.',
    'Available Opportunities':'Oportunidades disponibles','Explore openings by role and category.':'Explora oportunidades por puesto y categoría.',
    'Shop from Latino-owned businesses.':'Compra en negocios latinos.','Explore Products':'Explora productos',
    'Discover products from our community.':'Descubre productos de nuestra comunidad.',
    'News, resources, stories and opportunities for our community.':'Noticias, recursos, historias y oportunidades para nuestra comunidad.',
    'Community News & Resources':'Noticias y recursos para la comunidad',
    'Real articles will appear when the existing feed is connected.':'Recursos del servicio de la comunidad.',
    'Community Partners':'Aliados de la comunidad','Grow opportunities together.':'Creemos oportunidades juntos.',
    'Partner with My Latino List':'Colabora con My Latino List','Connect, support and grow.':'Conecta, apoya y crece.',
    'Let’s build stronger communities.':'Construyamos comunidades más fuertes.',
    'Get in touch to explore partnerships.':'Contáctanos para explorar alianzas.',
    'Contact partnerships →':'Consulta sobre alianzas →','CONTACT US':'CONTÁCTANOS',
    "Have questions? We're here to help Latino business owners":"¿Tienes preguntas? Estamos aquí para ayudar a los dueños de negocios latinos a",
    'succeed.':'tener éxito.','GENERAL':'GENERAL','PHONE':'TELÉFONO','SUPPORT':'SOPORTE',
    'PARTNERSHIPS':'ALIANZAS','BILLING & PAYMENTS':'FACTURACIÓN Y PAGOS','Send us a message':'Envíanos un mensaje',
    'Your name':'Tu nombre','Email address':'Correo electrónico','Message':'Mensaje','Send message':'Enviar mensaje',
    'Standalone preview: submission is disabled until the existing secure contact handler is connected.':'El formulario no está conectado en esta vista local. Usa los enlaces de contacto.',
    'Ask MLL AI':'Pregunta a MLL AI','✨ Ask MLL AI':'✨ Pregunta a MLL AI','Send':'Enviar',
    'Toggle navigation':'Abrir navegación','Close chat':'Cerrar chat','Location':'Ubicación','Language':'Idioma',
    'All locations':'Todas las ciudades','Search':'Buscar','City':'Ciudad','Name':'Nombre',
    'Tell us how we can help...':'Cuéntanos cómo podemos ayudarte...',
    'Ask MLL AI...':'Pregunta a MLL AI...'
  };
  Object.assign(window.I18N_ES,translations);
  if(document.documentElement.lang!=='es')return;
  const walker=document.createTreeWalker(document.querySelector('#app'),NodeFilter.SHOW_TEXT);
  let node;
  while((node=walker.nextNode())) {
    const key=node.nodeValue.trim();
    if(translations[key])node.nodeValue=node.nodeValue.replace(key,translations[key]);
  }
  document.querySelectorAll('[aria-label],[placeholder]').forEach(el=>{
    for(const attribute of ['aria-label','placeholder']) {
      const value=el.getAttribute(attribute);
      if(translations[value])el.setAttribute(attribute,translations[value]);
    }
  });
  const titles={home:'Inicio',businesses:'Negocios',detail:'Detalles del negocio',jobs:'Empleos',marketplace:'Mercado',voz:'La Voz Latino',contact:'Contacto',partners:'Aliados'};
  document.title='My Latino List V3 | '+titles[document.body.dataset.page];
})();
