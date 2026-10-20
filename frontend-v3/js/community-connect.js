/** Community Connect: authentic posters and three responsive native video cards. */
(function () {
  'use strict';

  var MLL_SOCIAL_LINKS = [
    {
      id: 'tiktok',
      labelEn: 'Follow us on TikTok',
      labelEs: 'Síguenos en TikTok',
      href: 'https://www.tiktok.com/@mylatinolist.io',
      icon: 'tiktok',
    },
    {
      id: 'instagram',
      labelEn: 'Follow us on Instagram',
      labelEs: 'Síguenos en Instagram',
      href: 'https://www.instagram.com/mylatinolist.io',
      icon: 'instagram',
    },
    {
      id: 'facebook',
      labelEn: 'Follow us on Facebook',
      labelEs: 'Síguenos en Facebook',
      href: 'https://www.facebook.com/mylatinolist.io',
      icon: 'facebook',
    },
    {
      id: 'youtube',
      labelEn: 'Follow us on YouTube',
      labelEs: 'Síguenos en YouTube',
      // TODO: Replace with official MyLatinoList YouTube channel URL when available.
      href: '#',
      icon: 'youtube',
      todo: true,
    },
  ];


  // Posters are cached from each video's official TikTok oEmbed thumbnail_url.
  // Refresh these local assets when replacing a video; never substitute stock imagery.
  var featuredVideos = [
    {
      id: 'mll-featured-negocio', videoId: '7686468241471835406',
      sourceType: 'mp4', brand: 'MLL',
      playbackUrl: 'https://media.mylatinolist.io/community/videos/mll-business-promo-final.mp4',
      titleEn: 'Do you own a business?', titleEs: '¿Tienes un negocio?',
      descriptionEn: 'Register your business free and connect with our community.',
      descriptionEs: 'Registra tu negocio gratis y conecta con nuestra comunidad.',
      posterUrl: '/assets/community/mll-featured-poster.jpg'
    },
    {
      id: 'mll-beauty', videoId: '7694080830490152206',
      sourceType: 'mp4', brand: 'MLL',
      playbackUrl: 'https://media.mylatinolist.io/community/videos/mll-salons-barbershops.mp4',
      titleEn: 'Discover Latino Salons & Barbershops', titleEs: 'Descubre Salones de Belleza y Barberías Latinas',
      descriptionEn: 'From hair salons and barbershops to nail studios, makeup artists, and beauty professionals  discover and support Latino-owned businesses on MyLatinoList.io.',
      descriptionEs: 'Descubre salones de belleza, barberías, especialistas en uñas, maquillaje y otros profesionales latinos. Apoya nuestros negocios en MyLatinoList.io!',
      posterUrl: '/assets/community/tiktok-7694080830490152206.jpg'
    },
    {
      id: 'mll-fashion', videoId: '7695145793958792462',
      sourceType: 'mp4', brand: 'MLL',
      playbackUrl: 'https://media.mylatinolist.io/community/videos/mll-fashion-boutiques.mp4',
      titleEn: 'Discover Latino fashion businesses', titleEs: 'Descubre negocios de moda latinos',
      descriptionEn: 'Meet boutiques, clothing stores, and independent Latino brands.',
      descriptionEs: 'Conoce boutiques, tiendas de ropa y marcas latinas independientes.',
      posterUrl: '/assets/community/tiktok-7695145793958792462.jpg'
    }
  ];
  featuredVideos.forEach(function (video) {
    video.externalUrl = 'https://www.tiktok.com/@mylatinolist.io/video/' + video.videoId;
  });

  var LOAD_TIMEOUT_MS = 15000;
  var ENROLL_HREF = 'pages/enroll.html';
  var language = null;
  var activeGallery = null;

  function iconSvg(name) {
    switch (name) {
      case 'tiktok':
        return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.95a8.17 8.17 0 004.77 1.52V7.02a4.85 4.85 0 01-1-.33z"/></svg>';
      case 'instagram':
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>';
      case 'facebook':
        return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/></svg>';
      case 'youtube':
        return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M22.54 6.42a2.78 2.78 0 00-1.94-2C18.88 4 12 4 12 4s-6.88.26-8.6.46a2.78 2.78 0 00-1.94 2A29 29 0 001 12a29 29 0 00.46 5.58 2.78 2.78 0 001.94 2c1.72.2 8.6.46 8.6.46s6.88-.26 8.6-.46a2.78 2.78 0 001.94-2A29 29 0 0023 12a29 29 0 00-.46-5.58zM9.75 15.02V8.98L15.5 12l-5.75 3.02z"/></svg>';
      default:
        return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="8"/></svg>';
    }
  }


  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/&/g, '&amp;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function currentLang() {
    if (language) return language;
    try { return localStorage.getItem('mll_lang') === 'es' ? 'es' : 'en'; }
    catch (e) { return 'en'; }
  }
  function text(en, es) { return currentLang() === 'es' ? es : en; }
  function bi(en, es) {
    return ' data-en="' + escapeHtml(en) + '" data-es="' + escapeHtml(es) + '">' + escapeHtml(text(en, es));
  }
  function aria(en, es) {
    return ' data-aria-en="' + escapeHtml(en) + '" data-aria-es="' + escapeHtml(es) +
      '" aria-label="' + escapeHtml(text(en, es)) + '"';
  }
  function poster(video, className) {
    return video.posterUrl
      ? '<img class="' + className + '" src="' + escapeHtml(video.posterUrl) + '" alt="" width="576" height="1024" loading="lazy" decoding="async">'
      : '<span class="' + className + ' cc-poster--pending" aria-hidden="true">MLL</span>';
  }
  function renderSocialButtons() {
    return MLL_SOCIAL_LINKS.filter(function (s) {
      return s && s.href && s.href !== '#' && !s.todo;
    }).map(function (s) {
      return '<a class="cc-social-btn" href="' + escapeHtml(s.href) + '" target="_blank" rel="noopener noreferrer"' +
        aria(s.labelEn, s.labelEs) + '><span class="cc-soc-icon">' + iconSvg(s.icon) + '</span><span' +
        bi(s.labelEn, s.labelEs) + '</span></a>';
    }).join('');
  }
  function renderCard(video, index) {
    return '<article class="cc-video-card" data-video-index="' + index + '">' +
      '<div class="cc-video-media" id="cc-player-' + index + '" aria-busy="false">' +
      '<div class="cc-preview">' + poster(video, 'cc-poster') + '</div>' +
      '<button class="cc-play" type="button"' + aria('Watch video: ' + video.titleEn, 'Ver video: ' + video.titleEs) + '>' +
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></button>' +
      '<div class="cc-embed-slot" hidden></div></div><div class="cc-card-body">' +
      '<p class="cc-brand">MLL &middot; My Latino List</p><h3 class="cc-card-title"' + bi(video.titleEn, video.titleEs) + '</h3>' +
      '<p class="cc-card-description"' + bi(video.descriptionEn, video.descriptionEs) + '</p>' +
      '<a class="cc-meta-link" href="' + escapeHtml(video.externalUrl) + '" target="_blank" rel="noopener noreferrer"' +
      bi('Open video on TikTok \u2197', 'Abrir video en TikTok \u2197') + '</a>' +
      '<p class="cc-status" role="status" aria-live="polite" aria-atomic="true"></p>' +
      '<div class="cc-recovery" hidden><a class="cc-fallback" href="' + escapeHtml(video.externalUrl) + '" target="_blank" rel="noopener noreferrer"' +
      bi('Watch on TikTok', 'Ver en TikTok') + '</a><button class="cc-retry" type="button"' +
      bi('Try again', 'Intentar de nuevo') + '</button></div></div></article>';
  }
  function renderSection() {
    return '<div class="wrap cc-wrap"><div class="cc-social-block"><div class="cc-eyebrow"' + bi('MLL COMMUNITY', 'COMUNIDAD MLL') + '</div>' +
      '<h2 class="cc-heading"' + bi('Follow Us & Connect', 'S\u00edguenos y Conecta') + '</h2>' +
      '<p class="cc-copy"' + bi('Discover Latino businesses, entrepreneurs, and stories from our growing community.',
        'Descubre negocios, emprendedores e historias de nuestra comunidad latina en crecimiento.') + '</p>' +
      '<div class="cc-social-row">' + renderSocialButtons() + '</div></div>' +
      '<div class="cc-videos-block" id="community-videos"><div class="cc-eyebrow"' + bi('FEATURED VIDEOS', 'VIDEOS DESTACADOS') + '</div>' +
      '<h2 class="cc-heading"' + bi('Stories From Our Community', 'Historias de Nuestra Comunidad') + '</h2>' +
      '<p class="cc-copy"' + bi('Choose a story to watch. Support the people behind our businesses.',
        'Elige una historia para verla. Apoya a las personas detr\u00e1s de nuestros negocios.') + '</p>' +
      '<div class="cc-video-grid">' + featuredVideos.map(renderCard).join('') + '</div>' +
      '<p class="cc-player-note"' + bi('Use the video controls for sound, playback, and fullscreen.',
        'Usa los controles del video para el sonido, la reproducci\u00f3n y la pantalla completa.') + '</p></div>' +
      '<div class="cc-appear-cta"><div><h3' + bi('Your business belongs here', 'Tu negocio tiene un lugar aqu\u00ed') + '</h3>' +
      '<p' + bi('Join our community. Register your business for free and help more people discover your story.',
        '\u00danete a nuestra comunidad. Registra tu negocio gratis y ayuda a m\u00e1s personas a descubrir tu historia.') + '</p></div>' +
      '<a class="cc-appear-btn" href="' + ENROLL_HREF + '"' + aria('Register your business for free', 'Registra tu negocio gratis') +
      bi('REGISTER YOUR BUSINESS FREE \u2192', 'REGISTRA TU NEGOCIO GRATIS \u2192') + '</a></div></div>';
  }
  function syncExistingLang(root) {
    root.querySelectorAll('[data-en]').forEach(function (el) { el.textContent = text(el.getAttribute('data-en'), el.getAttribute('data-es')); });
    root.querySelectorAll('[data-aria-en]').forEach(function (el) { el.setAttribute('aria-label', text(el.getAttribute('data-aria-en'), el.getAttribute('data-aria-es'))); });
    root.setAttribute('aria-label', text('My Latino List community', 'Comunidad My Latino List'));
  }
  function createPlayer(card, video, beforePlay) {
    var media = card.querySelector('.cc-video-media');
    var preview = card.querySelector('.cc-preview');
    var play = card.querySelector('.cc-play');
    var slot = card.querySelector('.cc-embed-slot');
    var status = card.querySelector('.cc-status');
    var recovery = card.querySelector('.cc-recovery');
    var retry = card.querySelector('.cc-retry');
    var title = card.querySelector('.cc-card-title');
    var description = card.querySelector('.cc-card-description');
    var external = card.querySelector('.cc-meta-link');
    var fallback = card.querySelector('.cc-fallback');
    var player = null, timer = null, disposed = false, state = 'preview';
    var bindings = [];
    function bind(node, event, handler, capture) {
      node.addEventListener(event, handler, capture);
      bindings.push(function () { node.removeEventListener(event, handler, capture); });
    }
    function clearTimer() { if (timer !== null) { clearTimeout(timer); timer = null; } }
    function updateText() {
      title.textContent = text(video.titleEn, video.titleEs);
      description.textContent = text(video.descriptionEn, video.descriptionEs);
      play.setAttribute('aria-label', text('Watch video: ' + video.titleEn, 'Ver video: ' + video.titleEs));
      external.href = fallback.href = video.externalUrl;
      external.setAttribute('aria-label', text('Open on TikTok: ' + video.titleEn, 'Abrir en TikTok: ' + video.titleEs));
      fallback.setAttribute('aria-label', text('Watch on TikTok: ' + video.titleEn, 'Ver en TikTok: ' + video.titleEs));
      retry.setAttribute('aria-label', text('Retry loading: ' + video.titleEn, 'Volver a cargar: ' + video.titleEs));
      if (player) {
        player.setAttribute('aria-label', text('Video: ' + video.titleEn, 'Video: ' + video.titleEs));
        player._mllFallback.textContent = text('Your browser does not support HTML5 video.', 'Tu navegador no admite video HTML5.');
      }
      var messages = {
        preview: ['Press play to watch this story.', 'Pulsa reproducir para ver esta historia.'],
        loading: ['Loading video\u2026', 'Cargando video\u2026'],
        ready: ['Video ready. Use the controls to play.', 'Video listo. Usa los controles para reproducirlo.'],
        playing: ['Video playing. Use the controls for sound and playback.', 'Video en reproducci\u00f3n. Usa los controles para el sonido y la reproducci\u00f3n.'],
        paused: ['Video paused. Use the controls to resume.', 'Video en pausa. Usa los controles para continuar.'],
        ended: ['Video ended. Use the controls to replay.', 'El video termin\u00f3. Usa los controles para volver a verlo.'],
        buffering: ['Video buffering. You can wait or try again.', 'El video est\u00e1 cargando. Puedes esperar o intentar de nuevo.'],
        slow: ['Video is taking longer to load. Try again or watch on TikTok.', 'El video est\u00e1 tardando en cargar. Intenta de nuevo o m\u00edralo en TikTok.'],
        blocked: ['Playback did not start. Use the video controls to play.', 'La reproducci\u00f3n no comenz\u00f3. Usa los controles del video para reproducirlo.'],
        error: ['This video could not load. Try again or watch on TikTok.', 'No se pudo cargar este video. Int\u00e9ntalo de nuevo o m\u00edralo en TikTok.']
      };
      var message = messages[state] || messages.preview;
      status.textContent = text(message[0], message[1]);
      media.setAttribute('data-player-state', state);
    }
    function resetPlayer() {
      clearTimer();
      var previous = player; player = null;
      if (previous) {
        previous.pause();
        previous.replaceChildren(); previous.removeAttribute('src'); previous.load();
      }
      slot.replaceChildren(); slot.hidden = true;
      media.setAttribute('aria-busy', 'false');
    }
    function showPlayer(attempt, nextState) {
      if (disposed || player !== attempt) return;
      clearTimer(); state = nextState;
      media.setAttribute('aria-busy', String(nextState === 'buffering'));
      recovery.hidden = nextState !== 'error' && nextState !== 'slow';
      updateText();
      if (nextState === 'buffering') watchTimeout(attempt);
    }
    function watchTimeout(attempt) {
      clearTimer(); timer = setTimeout(function () { showPlayer(attempt, 'slow'); }, LOAD_TIMEOUT_MS);
    }
    function requestPlay(attempt) {
      beforePlay();
      function rejected(error) {
        if (disposed || player !== attempt || (error && error.name === 'AbortError')) return;
        showPlayer(attempt, 'blocked'); // Native controls stay visible after a policy rejection.
      }
      try { var result = attempt.play(); if (result && typeof result.catch === 'function') result.catch(rejected); }
      catch (error) { rejected(error); }
    }
    function mount() {
      if (disposed) return;
      if (player) { requestPlay(player); return; }
      var attempt = document.createElement('video'); player = attempt;
      attempt.controls = true; attempt.setAttribute('playsinline', ''); attempt.preload = 'metadata'; attempt.poster = video.posterUrl;
      var source = document.createElement('source'); source.src = video.playbackUrl; source.type = 'video/mp4'; attempt.appendChild(source);
      attempt._mllFallback = document.createElement('span'); attempt.appendChild(attempt._mllFallback);
      ['loadedmetadata', 'canplay'].forEach(function (event) {
        bind(attempt, event, function () { if (state === 'loading' || state === 'slow') showPlayer(attempt, 'ready'); });
      });
      [['playing','playing'],['pause','paused'],['ended','ended'],['waiting','buffering'],['stalled','buffering'],['error','error']].forEach(function (pair) {
        bind(attempt, pair[0], function () { if (pair[0] === 'playing' && player === attempt && !disposed) beforePlay(); showPlayer(attempt, pair[1]); });
      });
      bind(source, 'error', function () { showPlayer(attempt, 'error'); });
      state = 'loading'; slot.hidden = false; preview.hidden = play.hidden = true; recovery.hidden = true;
      media.setAttribute('aria-busy', 'true'); slot.appendChild(attempt); updateText(); watchTimeout(attempt); attempt.load();
      requestPlay(attempt); // Called only by a user play/retry gesture.
    }
    bind(play, 'click', mount);
    bind(retry, 'click', function () { resetPlayer(); mount(); });
    updateText();
    return {
      play: mount,
      pause: function () { if (player && !player.paused) player.pause(); },
      syncLanguage: updateText,
      dispose: function () { disposed = true; resetPlayer(); bindings.forEach(function (remove) { remove(); }); }
    };
  }
  function createGallery(root, videos) {
    var cards = Array.from(root.querySelectorAll('.cc-video-card'));
    if (cards.length !== videos.length) throw new Error('Community video card count mismatch');
    var controllers = cards.map(function (card, index) {
      return createPlayer(card, videos[index], function () { controllers.forEach(function (controller, i) { if (i !== index) controller.pause(); }); });
    });
    function onImageError(event) { if (event.target && event.target.tagName === 'IMG') event.target.hidden = true; }
    root.addEventListener('error', onImageError, true);
    return {
      select: function (index) { if (Number.isInteger(index) && controllers[index]) controllers[index].play(); },
      syncLanguage: function () { controllers.forEach(function (controller) { controller.syncLanguage(); }); },
      dispose: function () { controllers.forEach(function (controller) { controller.dispose(); }); root.removeEventListener('error', onImageError, true); }
    };
  }
  function init() {
    var root = document.getElementById('mll-community-connect'); if (!root) return;
    if (activeGallery) activeGallery.dispose(); activeGallery = null;
    // Repair scope defensively if a future caller mounts the right ID with a wrong class.
    root.classList.add('mll-community-connect');
    try {
      root.innerHTML = renderSection(); syncExistingLang(root); activeGallery = createGallery(root, featuredVideos);
    } catch (error) {
      console.warn('MLL community connect failed to render', error);
      root.innerHTML = '<div class="wrap cc-wrap"><p class="cc-copy"' + bi('Explore our community on TikTok.', 'Descubre nuestra comunidad en TikTok.') + '</p>' +
        '<a class="cc-meta-link" href="https://www.tiktok.com/@mylatinolist.io" target="_blank" rel="noopener noreferrer">TikTok</a></div>';
    }
  }
  window.MLL_COMMUNITY_CONNECT = { socialLinks: MLL_SOCIAL_LINKS, featuredVideos: featuredVideos, init: init, createGallery: createGallery, renderSection: renderSection };
  document.addEventListener('mll:langswitch', function (event) {
    if (event.detail && (event.detail.lang === 'en' || event.detail.lang === 'es')) language = event.detail.lang;
    var root = document.getElementById('mll-community-connect'); if (root) syncExistingLang(root);
    if (activeGallery) activeGallery.syncLanguage();
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
