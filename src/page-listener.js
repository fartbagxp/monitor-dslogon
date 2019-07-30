const url = require('url');

const l = {};

const IGNOREABORT = [
  url.parse('https://bam.nr-data.net').hostname,
  url.parse('https://static.zdassets.com').hostname,
  url.parse('https://idme.zendesk.com').hostname,
  url.parse('https://www.facebook.com').hostname,
  url.parse('https://api.mapbox.com').hostname,
  url.parse('https://ping.chartbeat.net').hostname,
  url.parse('https://maps.googleapis.com').hostname
];

l.listen = page => {
  page.on('response', resp => {
    if (!resp.ok() && resp.status() !== 302 && resp.status() !== 304) {
      console.log(
        `${resp.url()} failed from unusual HTTP response code: ${resp.status()}`
      );
    }
  });

  page.on('requestfailed', req => {
    const hostname = url.parse(req.url()).hostname;
    if (!IGNOREABORT.includes(hostname)) {
      console.log(req.url() + ' ' + req.failure().errorText);
    }
  });

  page.on('requestfinished', req => {
    // console.log('request completed: ' + req.url());
  });
};

module.exports = l;
