const fs = require('fs');
const puppeteer = require('puppeteer');
const performance = require('perf_hooks').performance;
const request = require('superagent');

const config = require('./src/config');
const validation = require('./src/validate');
const statuspageio = require('./src/statuspage');

const authenticator = require('authenticator');

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
    mfaKey,
    slack,
    statuspage,
    debug
  ] = config.validateEnv();

  const dateTime = new Date().toISOString();

  // ignore HTTPS errors due to certificate errors
  const browser = await puppeteer.launch({
    ignoreHTTPSErrors: true,
    headless: true,
    slowMo: 100,
    args: ['--start-fullscreen']
  });

  // setup a listener for unhandled promise rejections
  process.on('unhandledRejection', (reason, p) => {
    const error = `an unhandled rejection at with reason: ${reason}`;
    console.error(error);

    // const endTime = performance.now();
    // const diffTimeInMs = endTime - start;

    // if (debug) {
    //   notifySlack(slack, error, diffTimeInMs / 1000);
    // }
    // statuspageio(statuspage).postUpDownMetric(0);
    browser.close();
  });

  console.log('Entering website now...');
  const start = performance.now();

  const pages = await browser.pages();
  let page = pages[0];

  page.on('response', resp => {
    if (!resp.ok() && resp.status() !== 302) {
      console.log(resp.url() + ' is not okay: ' + resp.status());
    }
  });

  page.on('requestfailed', req => {
    console.log(req.url() + ' ' + req.failure().errorText);
  });

  page.on('requestfinished', req => {
    // console.log('request completed: ' + req.url());
  });

  // set the navigation timeout to a longer timeout than 30 seconds, because
  // DSLogon can have extremely high latency (upwards of 60 sec) occasionally
  // Changing to optimal viewport because the default viewport means that DSLogon might take forever to load (why? no idea)
  page.setDefaultNavigationTimeout(60000);
  page.setViewport({ width: 1920, height: 900 });
  const REQ_TIMEOUT_MS = 2000;
  const MAX_RETRY = 5;
  const response = await retry(() => page.goto(url), REQ_TIMEOUT_MS, MAX_RETRY);

  // TODO: we should probably fail here and log it somewhere at failure
  console.log(`response: ${response.status()}`);

  // debug statement for getting to the website
  if (debug) {
    await screenshot(page, `${dateTime}-initial-website.png`);
  }

  console.log('got here 1');

  await page.waitForSelector(
    '.va-modal-inner > .va-modal-body > div > div > button'
  );
  await page.click('.va-modal-inner > .va-modal-body > div > div > button');

  console.log('got here 2');

  await page.waitForSelector('#mega-menu #vetnav-menu');
  await page.click('#mega-menu #vetnav-menu');

  console.log('got here 3');

  await page.waitForSelector(
    '.profile-nav-container > .profile-nav > .sign-in-nav > .sign-in-links > .sign-in-link'
  );
  await page.click(
    '.profile-nav-container > .profile-nav > .sign-in-nav > .sign-in-links > .sign-in-link'
  );

  console.log('got here 4');

  await page.waitForSelector(
    '.usa-width-one-half > .signin-actions-container > .signin-actions > div > .dslogon'
  );
  await page.click(
    '.usa-width-one-half > .signin-actions-container > .signin-actions > div > .dslogon'
  );

  console.log('got here 5');
  await page.waitForNavigation({ waitUntil: 'networkidle0' });

  // const sleep = seconds =>
  //   new Promise(resolve => setTimeout(resolve, (seconds || 1) * 1000));

  // console.log('Now waiting 5 seconds for DSLogon to load');
  // await new Promise(done => setTimeout(() => done(), 5000));
  console.log('got here 6');

  await page.waitForSelector(
    '#dslogon_content > .columnsContent > .formfield > label > #userName',
    { timeout: 60000 }
  );

  await page.click(
    '#dslogon_content > .columnsContent > .formfield > label > #userName'
  );

  await page.type(
    '#dslogon_content > .columnsContent > .formfield > label > #userName',
    username
  );

  await page.waitForSelector(
    '#dslogon_content > .columnsContent > .formfieldSmallGap > label[for=password-clear] > #password-clear',
    { timeout: 10000 }
  );

  await page.click(
    '#dslogon_content > .columnsContent > .formfieldSmallGap > label[for=password-clear] > #password-clear'
  );

  await page.type(
    '#dslogon_content > .columnsContent > .formfieldSmallGap > label[for=password-clear] > #password-clear',
    password
  );

  console.log('got here 7');

  // debug statement for writing credentials
  if (debug) {
    await screenshot(page, `${dateTime}-entering-credentials.png`);
  }

  await page.waitForSelector(
    '.tab-content > #dslogon_content > #dslogon_content > .columnsContent > .formbuttons'
  );
  await page.click(
    '.tab-content > #dslogon_content > #dslogon_content > .columnsContent > .formbuttons'
  );

  console.log('got here 8');

  await page.waitForSelector(
    '.form-container > #new_multifactor #multifactor_code',
    { timeout: 10000 }
  );
  await page.click('.form-container > #new_multifactor #multifactor_code');

  await page.type(
    '.form-container > #new_multifactor #multifactor_code',
    authenticator.generateToken(mfaKey)
  );

  await page.waitForSelector(
    '.form-container > #new_multifactor > .form-actions > .form-action-button > .btn'
  );
  await page.click(
    '.form-container > #new_multifactor > .form-actions > .form-action-button > .btn'
  );

  // const startLogonTime = performance.now();

  // // This is how to properly wait for an element on submit:
  // // https://github.com/GoogleChrome/puppeteer/issues/1637
  // await Promise.all([
  //   page.click('#dslogon_content > #dslogon_content #dsLogonButton'),
  //   page.waitForNavigation()
  // ]);
  // await page.click('#dslogon_content > #dslogon_content #dsLogonButton');
  // await page.waitForNavigation();
  console.log('got here 9');
  await page.waitForNavigation({ waitUntil: 'networkidle2' });
  await browser.close();

  // Track the final timing of the application run
  // This is the user end-to-end experience for time from logging in to logging off.
  let end = performance.now();
  let timeInMs = end - start;

  console.log(
    `Completed web session. Notifying slack now.
  Took ${timeInMs / 1000} seconds.`
  );

  console.log('got here 10');

  // setTimeout(() => {
  //   console.log('stopping time for 10 sec');
  // }, 10000);

  // const performanceTiming = JSON.parse(
  //   await page.evaluate(() => JSON.stringify(window.performance.timing))
  // );
  // const requestTimeMs =
  //   performanceTiming['responseEnd'] - performanceTiming['requestStart'];
  // console.log(
  //   `Completed logon. Request / Response roundtrip took ${requestTimeMs /
  //     1000} seconds`
  // );

  // // We  may need to log better with requestStart, and responseEnd counters:
  // // https://michaljanaszek.com/blog/test-website-performance-with-puppeteer#navigationTimingAPI
  // const endLogonTime = performance.now();
  // const totalLogonTimeInMs = endLogonTime - startLogonTime;
  // console.log(
  //   `Completed logon. Page load took ${totalLogonTimeInMs / 1000} seconds.`
  // );

  // // debug statement for completing login
  // if (debug) {
  //   await screenshot(page, `${dateTime}-login-completed.png`);
  // }

  // // store the HTML for true verification
  // let bodyHTML = await page.evaluate(() => document.body.innerHTML);
  // if (debug) {
  //   fs.writeFileSync(`debug/${dateTime}-page.html`, bodyHTML);
  // }

  // // properly logoff the site so no cookies are stored or saved
  // await page.waitForSelector('#page_bar_top > ul > li > a > #linkLogoff');
  // await page.click('#page_bar_top > ul > li > a > #linkLogoff');

  // // debug statement for completing login
  // if (debug) {
  //   await screenshot(page, `${dateTime}-logoff.png`);
  // }

  // // validate the HTML and notify the monitoring system
  // let errorText = validation.validateHtml(bodyHTML);
  // if (debug) {
  //   notifySlack(slack, errorText, timeInMs / 1000);
  // }

  // // send to statuspage.io
  // console.log('logging to statuspage.io');
  // let upOrDown = 0;
  // if (errorText === null) {
  //   upOrDown = 1;
  // }
  // statuspageio(statuspage).postMetrics(
  //   upOrDown,
  //   requestTimeMs,
  //   totalLogonTimeInMs,
  //   timeInMs
  // );
})();
