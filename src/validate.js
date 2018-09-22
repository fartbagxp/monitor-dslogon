const v = {};

/**
 * The thinking here is that if we can validate the HTML on some level,
 * we can ensure that the site is up provided the HTML.
 */
v.validateHtml = html => {
  if (html == null || html === '') {
    return 'No HTML found, could not validate HTML.';
  }

  const SEARCH_TERMS = [
    'currently logged on',
    'DS Logon',
    'Premium',
    'DS Logon Account Level'
  ];

  // look for particular search terms to ensure login is successful.
  for (const term in SEARCH_TERMS) {
    if (html.indexOf(term) === -1) {
      return `Could not verify content due to missing key term:${term} in HTML.`;
    }
  }

  return null;
};

module.exports = v;
