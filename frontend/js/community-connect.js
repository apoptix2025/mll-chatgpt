/**
 * Homepage community section — Follow Us & Connect / Síguenos y Conecta
 * Data-driven; uses existing site i18n (data-en/data-es + localStorage mll_lang).
 * TikTok: poster preview first; iframe mounts only on Play click (no embed.js).
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
   *
   * posterUrl for the featured TikTok was obtained via TikTok’s official oEmbed API
   * (GET https://www.tiktok.com/oembed?url=<externalUrl> → thumbnail_url), then
   * cached/optimized locally so we do not rely on signed CDN URLs that expire.
   * No TikTok MP4 was downloaded. Refresh poster via oEmbed when swapping videos.
   */
  var featuredVideos = [
    {
      id: 'mll-featured-negocio',
      sourceType: 'tiktok',
      type: 'tiktok',
      brand: 'MLL',
      badgeEn: 'MLL RECOMMENDS',
      badgeEs: 'MLL RECOMIENDA',
      titleEn: 'Do you own a business?',
      titleEs: '¿Tienes un negocio?',
      descriptionEn: 'Register your business FREE at MyLatinoList.io',
      descriptionEs: 'Registra tu negocio GRATIS en MyLatinoList.io',
      platform: 'tiktok',
      // Cached from TikTok oEmbed thumbnail_url for video 7686468241471835406 (2026-09-17).
      posterUrl: '/assets/community/mll-featured-poster.jpg',
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

  function isTikTokVideo(video) {
    var source = video && (video.sourceType || video.type);
    return source === 'tiktok' && video.embedUrl && video.externalUrl;
  }

  function brandLabel(video) {
    return (video && video.brand) || 'MLL';
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
    if (!isTikTokVideo(video)) return '';

    var brand = brandLabel(video);
    var hasPoster = !!(video.posterUrl && String(video.posterUrl).trim());
    // TODO: If posterUrl is missing for a future video, resolve via TikTok oEmbed
    // (GET https://www.tiktok.com/oembed?url=<externalUrl> → thumbnail_url) and
    // cache an optimized local asset — do not invent CDN image URLs.
    var posterHtml = hasPoster
      ? '<img class="cc-poster" src="' + escapeHtml(video.posterUrl) + '"' +
        ' alt="" width="540" height="960" loading="lazy" decoding="async" />'
      : '<div class="cc-poster cc-poster--pending" aria-hidden="true"></div>';

    var mediaInner =
      posterHtml +
      '<span class="cc-badge"' + bi(video.badgeEn, video.badgeEs) + '</span>' +
      '<span class="cc-platform-chip" aria-hidden="true">' + iconSvg('tiktok') + '</span>' +
      '<button type="button" class="cc-play" aria-label="' +
      escapeHtml(currentLang() === 'es' ? 'Reproducir video' : 'Play video') + '">' +
      '<span class="cc-play-icon" aria-hidden="true">' +
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>' +
      '</span>' +
      '</button>' +
      '<div class="cc-media-caption">' +
      '<div class="cc-media-brand">' + escapeHtml(brand) + '</div>' +
      '<div class="cc-media-title"' + bi(video.titleEn, video.titleEs) + '</div>' +
      '</div>' +
      '<a class="cc-fallback" href="' + escapeHtml(video.externalUrl) + '"' +
      ' target="_blank" rel="noopener noreferrer" hidden' +
      ' aria-label="' + escapeHtml(video.titleEn) + '">' +
      '<span class="cc-fallback-cta"' + bi('Watch on TikTok', 'Ver en TikTok') + '</span>' +
      '</a>' +
      '<div class="cc-embed-slot" data-embed-url="' + escapeHtml(video.embedUrl) + '"' +
      ' data-video-id="' + escapeHtml(video.videoId || '') + '" hidden></div>';

    return (
      '<article class="cc-video-card" data-video-id="' + escapeHtml(video.id) + '"' +
      (video.featured ? ' data-featured="1"' : '') + '>' +
      '<div class="cc-video-media" data-playable="1">' + mediaInner + '</div>' +
      '<div class="cc-video-body">' +
      '<p class="cc-video-desc"' + bi(video.descriptionEn, video.descriptionEs) + '</p>' +
      '<div class="cc-video-meta">' +
      escapeHtml(brand) +
      ' · <a class="cc-meta-link" href="' + escapeHtml(video.externalUrl) + '"' +
      ' target="_blank" rel="noopener noreferrer">TikTok</a>' +
      '</div>' +
      '</div>' +
      '</article>'
    );
  }

  function renderFeaturedSidePanel() {
    return (
      '<aside class="cc-featured-panel" aria-label="Featured community story">' +
      '<div class="cc-featured-brand" aria-hidden="true">' +
      '<span class="cc-brand-mark">MLL</span>' +
      '<span class="cc-brand-name">My Latino List</span>' +
      '</div>' +
      '<div class="cc-eyebrow"' + bi('FEATURED VIDEO', 'VIDEO DESTACADO') + '</div>' +
      '<h3 class="cc-featured-panel-title"' + bi('Supporting Our Community 💙', 'Apoyando Nuestra Comunidad 💙') + '</h3>' +
      '<p class="cc-featured-panel-copy"' + bi(
        'Discover stories, businesses, and creators who are part of My Latino List.',
        'Descubre historias, negocios y creadores que forman parte de My Latino List.'
      ) + '</p>' +
      '</aside>'
    );
  }

  /** Mount TikTok iframe only after Play — embed.js is not required for embed/v2. */
  function mountTikTokEmbed(media) {
    if (!media || media.getAttribute('data-playing') === '1') return;
    var slot = media.querySelector('.cc-embed-slot');
    if (!slot || slot.getAttribute('data-mounted') === '1') return;
    var url = slot.getAttribute('data-embed-url');
    if (!url) return;

    media.setAttribute('data-playing', '1');
    slot.setAttribute('data-mounted', '1');
    slot.hidden = false;

    var iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.title = 'TikTok — My Latino List';
    iframe.loading = 'lazy';
    iframe.allow = 'encrypted-media; picture-in-picture; fullscreen';
    iframe.setAttribute('allowfullscreen', '');
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';

    var fallback = media.querySelector('.cc-fallback');
    var playBtn = media.querySelector('.cc-play');
    var poster = media.querySelector('.cc-poster');
    var caption = media.querySelector('.cc-media-caption');
    var badge = media.querySelector('.cc-badge');
    var chip = media.querySelector('.cc-platform-chip');

    function hidePreview() {
      if (playBtn) playBtn.hidden = true;
      if (poster) poster.style.opacity = '0';
      if (caption) caption.style.opacity = '0';
      if (badge) badge.style.opacity = '0';
      if (chip) chip.style.opacity = '0';
    }

    iframe.addEventListener('load', function () {
      hidePreview();
      if (fallback) fallback.hidden = true;
    });
    iframe.addEventListener('error', function () {
      slot.hidden = true;
      media.removeAttribute('data-playing');
      if (playBtn) playBtn.hidden = true;
      if (fallback) fallback.hidden = false;
    });

    slot.appendChild(iframe);
    // Transition immediately so click feels responsive; iframe paints when ready.
    hidePreview();
  }

  function bindPlayControls(root) {
    root.querySelectorAll('.cc-video-media[data-playable="1"]').forEach(function (media) {
      var playBtn = media.querySelector('.cc-play');
      if (!playBtn) return;

      function activate(e) {
        if (e) e.preventDefault();
        mountTikTokEmbed(media);
      }

      playBtn.addEventListener('click', activate);
      // Clicking the poster area (not the TikTok fallback link) also plays.
      media.addEventListener('click', function (e) {
        if (media.getAttribute('data-playing') === '1') return;
        if (e.target.closest('.cc-fallback')) return;
        if (e.target.closest('.cc-play') || e.target.closest('.cc-poster') || e.target === media) {
          activate(e);
        }
      });
    });
  }

  /** Re-apply site language to this section after dynamic render. */
  function syncExistingLang(root) {
    var lang = currentLang();
    root.querySelectorAll('[data-en]').forEach(function (el) {
      var txt = lang === 'es' ? el.getAttribute('data-es') : el.getAttribute('data-en');
      if (txt != null) el.innerHTML = txt;
    });
    root.querySelectorAll('.cc-play').forEach(function (btn) {
      btn.setAttribute('aria-label', lang === 'es' ? 'Reproducir video' : 'Play video');
    });
  }

  function renderSection() {
    var videos = featuredVideos.filter(isTikTokVideo);
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
      bindPlayControls(mount);
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

  // Existing nav.js applyLang already updates [data-en]; mll:langswitch is extra safety
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
