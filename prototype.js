const puppeteer = require('puppeteer');
const listener = require('./src/page-listener');

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

function detectIssue(text) {
  if (!text && text === '') {
    return false;
  }

  if (
    (text.includes('DS Logon') && text.includes('trouble')) ||
    text.includes('signing in') ||
    text.includes('problems')
  ) {
    return true;
  }

  return false;
}

(async () => {
  const url = 'https://www.va.gov';

  // ignore HTTPS errors due to certificate errors
  const browser = await puppeteer.launch({
    ignoreHTTPSErrors: true,
    headless: false
    // args: ['--start-fullscreen']
  });

  // setup a listener for unhandled promise rejections
  process.on('unhandledRejection', (reason, p) => {
    const error = `an unhandled rejection at with reason: ${reason}`;
    console.error(error);
    browser.close();
  });

  const pages = await browser.pages();
  let page = pages[0];
  listener.listen(page);

  console.log('Entering website now...');

  // set the initial login to high timeout, along with retry.
  page.setDefaultNavigationTimeout(60000);
  page.setViewport({ width: 1920, height: 900 });
  const REQ_TIMEOUT_MS = 2000;
  const MAX_RETRY = 5;
  const response = await retry(() => page.goto(url), REQ_TIMEOUT_MS, MAX_RETRY);

  console.log(`response: ${response.status()}`);

  console.log('Awaiting va.gov page pop-up rendering');
  await page.waitForSelector(
    '.va-modal-inner > .va-modal-body > div > div > button'
  );
  await page.click('.va-modal-inner > .va-modal-body > div > div > button');

  console.log('Awaiting va.gov navigation menu rendering');
  await page.waitForSelector('#mega-menu #vetnav-menu');
  await page.click('#mega-menu #vetnav-menu');

  console.log('Awaiting va.gov sign-in button rendering');
  await page.waitForSelector(
    '.profile-nav-container > .profile-nav > .sign-in-nav > .sign-in-links > .sign-in-link'
  );
  await page.click(
    '.profile-nav-container > .profile-nav > .sign-in-nav > .sign-in-links > .sign-in-link'
  );

  console.log('Awaiting va.gov DSLogon sign-in button rendering through ID.me');
  await page.waitForSelector(
    '.usa-width-one-half > .signin-actions-container > .signin-actions > div > .dslogon'
  );

  const TIMEOUT_IN_SEC = 3000;
  const alertHeaders = await page
    .evaluate(() => {
      const heading = document.querySelector('.usa-alert-heading');
      if (heading && heading.textContent) {
        return heading.textContent;
      }
      return '';
    }, TIMEOUT_IN_SEC)
    .catch(function(err) {
      console.error(err);
    });

  // When DSLogon has an outage and va.gov detects an outage, a banner will
  // state the following in the alert header.
  //  'You may have trouble signing in with DS Logon'.
  // We should utilize the alert header as a way to determine outages.
  console.log(`Alert headers is: ${alertHeaders}`);
  if (detectIssue(alertHeaders)) {
    console.log('Problem signing in to DSLogon');
  }

  let alertText = await page
    .evaluate(() => {
      const text = document.querySelector('.usa-alert-text');
      if (text && text.textContent) {
        return text.textContent;
      }
      return '';
    }, TIMEOUT_IN_SEC)
    .catch(function(err) {
      console.error(err);
    });
  console.log(`Alert text is: ${alertText}`);

  // When DSLogon has an outage and va.gov detects an outage, a banner will
  // state the following in the alert text.
  //  'We’re sorry. We’re working to fix some problems with our DS Logon sign in process. If you’d like to sign in to VA.gov with your DS Logon account, please check back later.'
  // We should utilize the alert text as a way to determine outages.
  if (detectIssue(alertText)) {
    console.log('Problem signing in to DSLogon');
  }

  await browser.close();
})();
