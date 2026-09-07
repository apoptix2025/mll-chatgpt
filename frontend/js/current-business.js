// Resolve the assigned business from GET /api/auth/me.
// Always uses profiles.business_id. Never defaults to the first owned listing.
(function (global) {
  var ADMIN_EMAILS = ['info@apoptix.io'];

  function isAdminEmail(email) {
    return ADMIN_EMAILS.indexOf(String(email || '').toLowerCase()) !== -1;
  }

  function asList(raw) {
    if (Array.isArray(raw)) return raw.filter(Boolean);
    return raw ? [raw] : [];
  }

  function resolveAssignedBusiness(me) {
    var profile = me && me.profile ? me.profile : null;
    var user = me && me.user ? me.user : null;
    var email = (user && user.email) || (profile && profile.email) || '';
    var assignedId = profile && profile.business_id ? profile.business_id : null;
    var list = asList(profile && profile.businesses);
    var business = null;
    if (assignedId) {
      for (var i = 0; i < list.length; i++) {
        if (list[i] && list[i].id === assignedId) {
          business = list[i];
          break;
        }
      }
    }
    return {
      business: business,
      assignedId: assignedId,
      isAdmin: isAdminEmail(email),
      profile: profile,
      user: user,
    };
  }

  function syncAssignedBusinessId(assignedId) {
    try {
      if (assignedId) sessionStorage.setItem('mll_business_id', assignedId);
      else sessionStorage.removeItem('mll_business_id');
    } catch (e) { /* ignore */ }
  }

  function injectAdminSidebarLinks(sidebar, isAdmin) {
    if (!sidebar) return;
    var existing = sidebar.querySelectorAll('[data-mll-admin-nav]');
    for (var i = 0; i < existing.length; i++) existing[i].remove();
    if (!isAdmin) return;

    var signOut = sidebar.querySelector('a[href="login.html"]');
    var admin = document.createElement('a');
    admin.href = 'admin.html';
    admin.className = 'sb-link';
    admin.setAttribute('data-mll-admin-nav', '1');
    admin.textContent = 'Admin';

    var health = document.createElement('a');
    health.href = 'health.html';
    health.className = 'sb-link';
    health.setAttribute('data-mll-admin-nav', '1');
    health.textContent = 'System Health';

    var mcc = document.createElement('a');
    mcc.href = 'marketing-command-center.html';
    mcc.className = 'sb-link';
    mcc.setAttribute('data-mll-admin-nav', '1');
    mcc.textContent = 'Command Center';

    if (signOut && signOut.parentNode) {
      signOut.parentNode.insertBefore(admin, signOut);
      signOut.parentNode.insertBefore(health, signOut);
      signOut.parentNode.insertBefore(mcc, signOut);
    } else {
      sidebar.appendChild(admin);
      sidebar.appendChild(health);
      sidebar.appendChild(mcc);
    }
  }

  global.MLL_CURRENT_BUSINESS = {
    isAdminEmail: isAdminEmail,
    resolveAssignedBusiness: resolveAssignedBusiness,
    syncAssignedBusinessId: syncAssignedBusinessId,
    injectAdminSidebarLinks: injectAdminSidebarLinks,
  };
})(typeof window !== 'undefined' ? window : globalThis);
