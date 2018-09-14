const fs = require('fs');
const puppeteer = require('puppeteer');
const performance = require('perf_hooks').performance;
const request = require('superagent');

const statuspageio = require('./statuspage');

/**
 * Ensure that the environment and credentials are set.
 */
function validateEnv() {
  const dotenv = require('dotenv');
  dotenv.config();

  const url = process.env.url;
  const username = process.env.username;
  const password = process.env.password;
  const slackUrl = process.env.slack_webhook_url;
  const slackChannel = process.env.slack_channel;
  const slackUser = process.env.slack_user;
  const statuspageApiKey = process.env.statuspage_api_key;
  const statuspagePageId = process.env.statuspage_page_id;
  const statuspageUpdownMetricId = process.env.statuspage_metric_updown_id;
  const statuspageLoginMetricId = process.env.statuspage_metric_login_id;
  const statuspageApiBase = process.env.statuspage_api_base;

  let debug = false;

  if (url == null || url === '') {
    console.error('No url has been set in environment.');
    process.exit(1);
  }

  if (username == null || username === '') {
    console.error('No username has been set in environment.');
    process.exit(1);
  }

  if (password == null || password === '') {
    console.error('No password has been set in environment.');
    process.exit(1);
  }

  let isSlackAvailable = true;
  if (slackUrl == null || slackUrl === '') {
    console.warn('No slack URL has been set in environment.');
    isSlackAvailable = false;
  }

  if (slackChannel == null || slackChannel === '') {
    console.warn('No slack channel has been set in environment.');
    isSlackAvailable = false;
  }

  if (slackUser == null || slackUser === '') {
    console.warn('No slack user has been set in environment.');
    isSlackAvailable = false;
  }

  let isStatusPageIOAvailable = true;
  if (statuspageApiKey == null || statuspageApiKey === '') {
    console.warn('No StatusPage.io API Key has been set in environment.');
    isStatusPageIOAvailable = false;
  }

  if (statuspagePageId == null || statuspagePageId === '') {
    console.warn('No StatusPage.io Page ID has been set in environment.');
    isStatusPageIOAvailable = false;
  }

  if (statuspageUpdownMetricId == null || statuspageUpdownMetricId === '') {
    console.warn(
      'No StatusPage.io Up/down Metric ID has been set in environment.'
    );
    isStatusPageIOAvailable = false;
  }

  if (statuspageLoginMetricId == null || statuspageLoginMetricId === '') {
    console.warn(
      'No StatusPage.io Login Metric ID has been set in environment.'
    );
    isStatusPageIOAvailable = false;
  }

  if (statuspageApiBase == null || statuspageApiBase === '') {
    console.warn('No StatusPage.io API Base has been set in environment.');
    isStatusPageIOAvailable = false;
  }

  let slack = {
    url: slackUrl,
    channel: slackChannel,
    user: slackUser
  };
  if (!isSlackAvailable) {
    slack = null;
    console.log('Slack keys are not available. No Slack integration detected.');
  }

  let statuspage = {
    apiKey: statuspageApiKey,
    pageId: statuspagePageId,
    updownMetricId: statuspageUpdownMetricId,
    loginMetricId: statuspageLoginMetricId,
    apiBase: statuspageApiBase
  };
  if (!isStatusPageIOAvailable) {
    statuspage = null;
    console.log(
      'statuspage.io keys are not available. No statuspage.io integration detected.'
    );
  }

  // debug flag for whether we log everything
  if (process.env.NODE_ENV === 'dev') {
    debug = true;
  }

  return [url, username, password, slack, statuspage, debug];
}

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
 * The thinking here is that if we can validate the HTML on some level,
 * we can ensure that the site is up provided the HTML.
 */
function validateHtml(html) {
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
  const [url, username, password, slack, statuspage, debug] = validateEnv();

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
  // page.setDefaultNavigationTimeout(30000);
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

  // This is how to properly wait for an element on submit:
  // https://github.com/GoogleChrome/puppeteer/issues/1637
  await Promise.all([
    page.click(
      '.col-xs-4 > #dslogon_content > .columnsContent > .formbuttons > #dsLogonButton'
    ),
    page.waitForNavigation()
  ]);

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

  // Track the timing
  let end = performance.now();
  let timeInMs = end - start;

  console.log(
    `Completed web session. Notifying slack now.
    Took ${timeInMs / 1000} seconds.`
  );

  // validate the HTML and notify the monitoring system
  let errorText = validateHtml(bodyHTML);
  if (debug) {
    notifySlack(slack, errorText, timeInMs / 1000);
  }

  // send to statuspage.io
  console.log('logging to statuspage.io');
  let upOrDown = 0;
  if (errorText === null) {
    upOrDown = 1;
  }
  statuspageio(statuspage).postMetrics(upOrDown, timeInMs);
})();
