(function (root) {
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function formatUtcDateOnly(iso) {
    var match = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return '—';
    var month = MONTHS[Number(match[2]) - 1];
    if (!month) return '—';
    return month + ' ' + Number(match[3]) + ', ' + match[1];
  }

  root.MLL_DATE = { formatUtcDateOnly: formatUtcDateOnly };
})(typeof window !== 'undefined' ? window : globalThis);
