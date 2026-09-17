/**
 * Homepage community section — Follow Us & Connect / Síguenos y Conecta
 * Data-driven; uses existing site i18n (data-en/data-es + localStorage mll_lang).
 * TikTok: lazy iframe only (no embed.js).
 */
(function () {
  'use strict';

  /**
   * Social destinations (config — do not scatter URLs through markup).
   * Labels use data-en / data-es so nav.js switchLang() updates them.
   */
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

  /**
   * Featured community videos.
   * Layout modes (CSS classes on .cc-video-layout):
   *   1 video  → cc-video-layout--single  (featured side-by-side panel)
   *   2–3      → cc-video-layout--grid
   *   4–5      → cc-video-layout--many    (responsive grid / native scroll)
   * Only the 1-video path renders today; keep this array data-driven for expansion.
   */
  var featuredVideos = [
    {
      id: 'aleja-recomienda-mll',
      type: 'tiktok',
      badgeEn: 'MLL RECOMMENDS',
      badgeEs: 'RECOMIENDA MLL',
      titleEn: 'Do you own a business?',
      titleEs: '¿Tienes un negocio?',
      descriptionEn: 'Register your business FREE at MyLatinoList.io',
      descriptionEs: 'Registra tu negocio GRATIS en MyLatinoList.io',
      creator: 'Aleja',
      platform: 'tiktok',
      externalUrl: 'https://www.tiktok.com/@mylatinolist.io/video/7686468241471835406',
      embedUrl: 'https://www.tiktok.com/embed/v2/7686468241471835406',
      videoId: '7686468241471835406',
      featured: true,
    },
  ];

  var ENROLL_HREF = 'pages/enroll.html';

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
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function bi(en, es) {
    return ' data-en="' + escapeHtml(en) + '" data-es="' + escapeHtml(es) + '">' + escapeHtml(en);
  }

  function currentLang() {
    try { return localStorage.getItem('mll_lang') || 'en'; } catch (e) { return 'en'; }
  }

  function layoutMode(count) {
    if (count <= 1) return 'cc-video-layout--single';
    if (count <= 3) return 'cc-video-layout--grid';
    return 'cc-video-layout--many';
  }

  function renderSocialButtons() {
    // Hide unfinished destinations (e.g. YouTube href '#') — no dead buttons in production.
    return MLL_SOCIAL_LINKS.filter(function (s) {
      return s && s.href && s.href !== '#' && !s.todo;
    }).map(function (s) {
      return (
        '<a class="cc-social-btn" href="' + escapeHtml(s.href) + '"' +
        ' target="_blank" rel="noopener noreferrer"' +
        ' aria-label="' + escapeHtml(s.labelEn) + '">' +
        '<span class="cc-soc-icon">' + iconSvg(s.icon) + '</span>' +
        '<span' + bi(s.labelEn, s.labelEs) + '</span>' +
        '</a>'
      );
    }).join('');
  }

  function renderVideoCard(video) {
    var isTikTok = video.type === 'tiktok' && video.embedUrl && video.externalUrl;
    var mediaInner =
      '<span class="cc-badge"' + bi(video.badgeEn, video.badgeEs) + '</span>' +
      '<span class="cc-platform-chip" aria-hidden="true">' + iconSvg('tiktok') + '</span>' +
      '<a class="cc-fallback" href="' + escapeHtml(video.externalUrl) + '" target="_blank" rel="noopener noreferrer"' +
      ' aria-label="' + escapeHtml(video.titleEn) + '">' +
      '<span class="cc-fallback-play" aria-hidden="true">' +
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>' +
      '</span>' +
      '<div>' +
      (video.creator ? '<div class="cc-fallback-creator">' + escapeHtml(video.creator) + '</div>' : '') +
      '<div class="cc-fallback-title"' + bi(video.titleEn, video.titleEs) + '</div>' +
      '<span class="cc-fallback-cta"' + bi('Watch on TikTok', 'Ver en TikTok') + '</span>' +
      '</div>' +
      '</a>' +
      '<div class="cc-embed-slot" data-embed-url="' + escapeHtml(video.embedUrl) + '" data-video-id="' + escapeHtml(video.videoId || '') + '" hidden></div>';

    if (!isTikTok) return '';

    return (
      '<article class="cc-video-card" data-video-id="' + escapeHtml(video.id) + '"' +
      (video.featured ? ' data-featured="1"' : '') + '>' +
      '<div class="cc-video-media">' + mediaInner + '</div>' +
      '<div class="cc-video-body">' +
      '<h3 class="cc-video-title"' + bi(video.titleEn, video.titleEs) + '</h3>' +
      '<p class="cc-video-desc"' + bi(video.descriptionEn, video.descriptionEs) + '</p>' +
      '<div class="cc-video-meta">' + escapeHtml(video.creator || '') + ' · TikTok</div>' +
      '</div>' +
      '</article>'
    );
  }

  function renderFeaturedSidePanel() {
    return (
      '<aside class="cc-featured-panel" aria-label="Featured community story">' +
      '<div class="cc-featured-brand" aria-hidden="true">' +
      '<span class="cc-brand-mark">MLL</span>' +
      '<span class="cc-brand-name">my<strong>latino</strong>list</span>' +
      '</div>' +
      '<div class="cc-eyebrow"' + bi('Featured Video', 'Video Destacado') + '</div>' +
      '<h3 class="cc-featured-panel-title"' + bi('Supporting Our Community 💙', 'Apoyando nuestra comunidad 💙') + '</h3>' +
      '<p class="cc-featured-panel-copy"' + bi(
        'Discover stories, businesses, and creators who are part of My Latino List.',
        'Conoce historias, negocios y creadores que forman parte de My Latino List.'
      ) + '</p>' +
      '</aside>'
    );
  }

  /** Lazy iframe mount only — TikTok embed.js is not required for embed/v2 iframes. */
  function mountTikTokEmbed(slot) {
    if (!slot || slot.getAttribute('data-mounted') === '1') return;
    var url = slot.getAttribute('data-embed-url');
    if (!url) return;
    slot.setAttribute('data-mounted', '1');
    slot.hidden = false;

    var iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.title = 'TikTok — My Latino List';
    iframe.loading = 'lazy';
    iframe.allow = 'encrypted-media; picture-in-picture; fullscreen';
    iframe.setAttribute('allowfullscreen', '');
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';

    var media = slot.parentElement;
    var fallback = media ? media.querySelector('.cc-fallback') : null;

    iframe.addEventListener('load', function () {
      if (fallback) {
        fallback.style.opacity = '0';
        fallback.style.pointerEvents = 'none';
      }
    });
    iframe.addEventListener('error', function () {
      slot.hidden = true;
      if (fallback) {
        fallback.style.opacity = '1';
        fallback.style.pointerEvents = 'auto';
      }
    });

    slot.appendChild(iframe);
  }

  function observeEmbeds(root) {
    var slots = root.querySelectorAll('.cc-embed-slot');
    if (!slots.length) return;

    if (!('IntersectionObserver' in window)) {
      slots.forEach(function (slot) { mountTikTokEmbed(slot); });
      return;
    }

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            mountTikTokEmbed(entry.target);
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '120px 0px', threshold: 0.15 }
    );

    slots.forEach(function (slot) { io.observe(slot); });
  }

  /** Re-apply site language to this section after dynamic render. */
  function syncExistingLang(root) {
    var lang = currentLang();
    root.querySelectorAll('[data-en]').forEach(function (el) {
      var txt = lang === 'es' ? el.getAttribute('data-es') : el.getAttribute('data-en');
      if (txt != null) el.innerHTML = txt;
    });
  }

  function renderSection() {
    var videos = featuredVideos.filter(function (v) { return v && v.type === 'tiktok'; });
    var mode = layoutMode(videos.length);
    var showViewMore = videos.length > 1;
    var cards = videos.map(renderVideoCard).join('');

    var videoArea;
    if (mode === 'cc-video-layout--single') {
      videoArea =
        '<div class="cc-video-layout ' + mode + '">' +
        '<div class="cc-single-stage">' +
        cards +
        renderFeaturedSidePanel() +
        '</div>' +
        '</div>';
    } else {
      videoArea =
        '<div class="cc-video-layout ' + mode + '">' +
        '<div class="cc-video-grid" role="list">' + cards + '</div>' +
        '</div>';
    }

    return (
      '<div class="cc-wrap">' +
      '<div class="cc-social-block">' +
      '<div class="cc-eyebrow"' + bi('MLL COMMUNITY', 'COMUNIDAD MLL') + '</div>' +
      '<h2 class="cc-heading"' + bi('Follow Us & Connect 💙', 'Síguenos y Conecta 💙') + '</h2>' +
      '<p class="cc-lead"' + bi('The My Latino List community is growing.', 'La comunidad de My Latino List está creciendo.') + '</p>' +
      '<p class="cc-copy"' + bi(
        'Discover Latino businesses, entrepreneurs, opportunities, and community content.',
        'Descubre negocios, emprendedores, oportunidades y contenido de nuestra comunidad latina.'
      ) + '</p>' +
      '<div class="cc-social-row" role="list">' + renderSocialButtons() + '</div>' +
      '</div>' +

      '<div class="cc-videos-block" id="community-videos">' +
      '<div class="cc-videos-header">' +
      '<div>' +
      '<div class="cc-eyebrow"' + bi('FEATURED VIDEOS', 'VIDEOS DESTACADOS') + '</div>' +
      '<h2 class="cc-heading"' + bi('Stories From Our Community', 'Historias de Nuestra Comunidad') + '</h2>' +
      '</div>' +
      (showViewMore
        ? '<a class="cc-view-more" href="#community-videos"' + bi('View more videos →', 'Ver más videos →') + '</a>'
        : '') +
      '</div>' +
      '<p class="cc-copy"' + bi(
        'Meet the people, businesses, and creators helping our community grow.',
        'Conoce las personas, negocios y creadores que están haciendo crecer nuestra comunidad.'
      ) + '</p>' +
      videoArea +
      '</div>' +

      '<div class="cc-appear-cta">' +
      '<div class="cc-appear-copy">' +
      '<h3' + bi('Want to be featured here?', '¿Quieres aparecer aquí?') + '</h3>' +
      '<p' + bi(
        'Register your business for free and become part of our community. Your story can inspire others too.',
        'Registra tu negocio gratis y forma parte de nuestra comunidad. Tu historia también puede inspirar.'
      ) + '</p>' +
      '</div>' +
      '<a class="cc-appear-btn" href="' + ENROLL_HREF + '"' +
      bi('REGISTER YOUR BUSINESS FREE →', 'REGISTRA TU NEGOCIO GRATIS →') + '</a>' +
      '</div>' +
      '</div>'
    );
  }

  function init() {
    var mount = document.getElementById('mll-community-connect');
    if (!mount) return;
    try {
      mount.innerHTML = renderSection();
      syncExistingLang(mount);
      observeEmbeds(mount);
    } catch (err) {
      console.warn('MLL community connect failed to render', err);
      mount.innerHTML =
        '<div class="cc-wrap"><p class="cc-copy">' +
        '<a href="https://www.tiktok.com/@mylatinolist.io" target="_blank" rel="noopener noreferrer">TikTok</a></p></div>';
    }
  }

  window.MLL_COMMUNITY_CONNECT = {
    socialLinks: MLL_SOCIAL_LINKS,
    featuredVideos: featuredVideos,
    init: init,
  };

  // Existing nav.js applyLang already updates [data-en]/ mll:langswitch is extra safety
  // if other scripts re-render after a language change.
  document.addEventListener('mll:langswitch', function () {
    var mount = document.getElementById('mll-community-connect');
    if (mount) syncExistingLang(mount);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
