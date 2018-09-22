const fs = require('fs');
const puppeteer = require('puppeteer');
const performance = require('perf_hooks').performance;
const request = require('superagent');

const config = require('./src/config');
const validation = require('./src/validate');
const statuspageio = require('./src/statuspage');

/**
 * Take a simple screenshot and store it in the local screenshot folder.
 * This is great for debugging.
 */
async function screenshot(page, filename) {
  if (filename == null && filename == '') {
    console.error(
      'filename is empty, screenshot must have a proper .png filename.'
    );
    return;
  }
  await page.screenshot({ path: `debug/${filename}` });
}

/**
 * A quick way of monitoring via slack for now.
 */
async function notifySlack(slack, errorText, timeinSec) {
  if (slack == null) {
    return;
  }

  const payload = {
    channel: `#${slack.channel}`,
    username: slack.username,
    icon_emoji: ':dslogon:'
  };
  if (errorText == null || errorText === '') {
    payload.text = `\`SUCCESS!\` DSLogon login successful.\
    HTML has been validated.\
    Time taken: ${timeinSec.toFixed(2)} sec.`;
  } else {
    payload.text = `\`FAILED!\` DSLogon login failed.\
    Error was: ${errorText}. \
    Time taken: ${timeinSec.toFixed(2)} sec.`;
  }

  await request
    .post(slack.url)
    .send(payload)
    .catch(err => {
      console.error('Unable to send messages to the slack webhook');
    });
}

/**
 * Retry upon failure with a max timeout.
 *
 * @param {Func} fn Function to retry
 * @param {Time} ms Time in millis
 */
const retry = (fn, ms = 1000, maxRetries = 5) =>
  new Promise((resolve, reject) => {
    var retries = 0;
    fn()
      .then(resolve)
      .catch(() => {
        setTimeout(() => {
          console.log('retrying failed promise...');
          ++retries;
          if (retries == maxRetries) {
            return reject('maximum retries exceeded');
          }
          retry(fn, ms).then(resolve);
        }, ms);
      });
  });

/**
 * This is the heart of the monitoring system.
 * 1. Navigate to the main page and begin logging in.
 * 2. Use the credentials provided in .env
 * 3. (debug) use the screenshot function to place a screenshot in the debug folder
 */
(async () => {
  const [
    url,
    username,
    password,
    slack,
    statuspage,
    debug
  ] = config.validateEnv();

  const dateTime = new Date().toISOString();

  // ignore HTTPS errors due to certificate errors
  const browser = await puppeteer.launch({
    ignoreHTTPSErrors: true,
    headless: true
  });

  // setup a listener for unhandled promise rejections
  process.on('unhandledRejection', (reason, p) => {
    const error = `an unhandled rejection at with reason: ${reason}`;
    console.error(error);

    const endTime = performance.now();
    const diffTimeInMs = endTime - start;

    if (debug) {
      notifySlack(slack, error, diffTimeInMs / 1000);
    }
    statuspageio(statuspage).postUpDownMetric(0);
    browser.close();
  });

  console.log('Entering website now...');
  const start = performance.now();

  const page = await browser.newPage();

  // set the navigation timeout to a longer timeout than 30 seconds, because
  // DSLogon can have extremely high latency (upwards of 60 sec) occasionally
  page.setDefaultNavigationTimeout(60000);
  const REQ_TIMEOUT_MS = 2000;
  const MAX_RETRY = 5;
  const response = await retry(() => page.goto(url), REQ_TIMEOUT_MS, MAX_RETRY);

  // TODO: we should probably fail here and log it somewhere at failure
  console.log(`response: ${response.status()}`);

  // debug statement for getting to the website
  if (debug) {
    await screenshot(page, `${dateTime}-initial-website.png`);
  }

  await page.waitForSelector(
    '#pageHolder > #contentHolder > #advisory > form > .btn'
  );

  await Promise.all([
    page.click('#pageHolder > #contentHolder > #advisory > form > .btn'),
    page.waitForNavigation()
  ]);

  await page.waitForSelector(
    '#dslogon_content > .columnsContent > .formfield > label > #userName'
  );
  await page.click(
    '#dslogon_content > .columnsContent > .formfield > label > #userName'
  );

  await page.type(
    '#dslogon_content > .columnsContent > .formfield > label > #userName',
    username
  );

  await page.click(
    '#dslogon_content > .columnsContent > .formfieldSmallGap > label[for=password-clear] > #password-clear'
  );

  await page.type(
    '#dslogon_content > .columnsContent > .formfieldSmallGap > label[for=password-clear] > #password-clear',
    password
  );

  // debug statement for writing credentials
  if (debug) {
    await screenshot(page, `${dateTime}-entering-credentials.png`);
  }

  await page.waitForSelector(
    '.col-xs-4 > #dslogon_content > .columnsContent > .formbuttons > #dsLogonButton'
  );

  const startLogonTime = performance.now();

  // This is how to properly wait for an element on submit:
  // https://github.com/GoogleChrome/puppeteer/issues/1637
  await Promise.all([
    page.click(
      '.col-xs-4 > #dslogon_content > .columnsContent > .formbuttons > #dsLogonButton'
    ),
    page.waitForNavigation()
  ]);

  const performanceTiming = JSON.parse(
    await page.evaluate(() => JSON.stringify(window.performance.timing))
  );
  const requestTimeMs =
    performanceTiming['responseEnd'] - performanceTiming['requestStart'];
  console.log(
    `Completed logon. Request / Response roundtrip took ${requestTimeMs /
      1000} seconds`
  );

  // We  may need to log better with requestStart, and responseEnd counters:
  // https://michaljanaszek.com/blog/test-website-performance-with-puppeteer#navigationTimingAPI
  const endLogonTime = performance.now();
  const totalLogonTimeInMs = endLogonTime - startLogonTime;
  console.log(
    `Completed logon. Page load took ${totalLogonTimeInMs / 1000} seconds.`
  );

  // debug statement for completing login
  if (debug) {
    await screenshot(page, `${dateTime}-login-completed.png`);
  }

  // store the HTML for true verification
  let bodyHTML = await page.evaluate(() => document.body.innerHTML);
  if (debug) {
    fs.writeFileSync(`debug/${dateTime}-page.html`, bodyHTML);
  }

  // properly logoff the site so no cookies are stored or saved
  await page.waitForSelector('#page_bar_top > ul > li > a > #linkLogoff');
  await page.click('#page_bar_top > ul > li > a > #linkLogoff');

  // debug statement for completing login
  if (debug) {
    await screenshot(page, `${dateTime}-logoff.png`);
  }

  await browser.close();

  // Track the final timing of the application run
  // This is the user end-to-end experience for time from logging in to logging off.
  let end = performance.now();
  let timeInMs = end - start;

  console.log(
    `Completed web session. Notifying slack now.
    Took ${timeInMs / 1000} seconds.`
  );

  // validate the HTML and notify the monitoring system
  let errorText = validation.validateHtml(bodyHTML);
  if (debug) {
    notifySlack(slack, errorText, timeInMs / 1000);
  }

  // send to statuspage.io
  console.log('logging to statuspage.io');
  let upOrDown = 0;
  if (errorText === null) {
    upOrDown = 1;
  }
  statuspageio(statuspage).postMetrics(
    upOrDown,
    requestTimeMs,
    totalLogonTimeInMs,
    timeInMs
  );
})();
