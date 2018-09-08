const puppeteer = require('puppeteer');
const fs = require('fs');

/**
 * Ensure that the environment and credentials are set.
 */
function validateEnv() {
  const dotenv = require('dotenv');
  dotenv.config();

  const username = process.env.username;
  const password = process.env.password;
  let debug = false;

  if (username == null || username === '') {
    console.error('No username has been set in environment.');
    process.exit(1);
  }

  if (password == null || password === '') {
    console.error('No password has been set in environment.');
    process.exit(1);
  }

  // debug flag for whether we log everything
  if (process.env.NODE_ENV === 'dev') {
    debug = true;
  }

  return [username, password, debug];
}

/**
 * A simple function for delaying the script for x number of milliseconds.
 */
function delay(timeInMs) {
  return new Promise(function(resolve) {
    setTimeout(resolve, timeInMs);
  });
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
 * This is the heart of the monitoring system.
 * 1. Navigate to the main page and begin logging in.
 * 2. Use the credentials provided in .env
 * 3. (debug) use the screenshot function to place a screenshot in the debug folder
 */
(async () => {
  const [username, password, debug] = validateEnv();
  const dateTime = new Date().toISOString();

  URL = 'https://www.dmdc.osd.mil/identitymanagement/profile/home.do';

  // ignore HTTPS errors due to certificate errors
  const browser = await puppeteer.launch({
    ignoreHTTPSErrors: true
  });

  const page = await browser.newPage();
  await page.goto(URL);

  const navigationPromise = page.waitForNavigation();

  // debug statement for getting to the website
  if (debug) {
    await screenshot(page, `${dateTime}-initial-website.png`);
  }

  await page.waitForSelector(
    '#pageHolder > #contentHolder > #advisory > form > .btn'
  );
  await page.click('#pageHolder > #contentHolder > #advisory > form > .btn');

  await navigationPromise;

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
  await page.click(
    '.col-xs-4 > #dslogon_content > .columnsContent > .formbuttons > #dsLogonButton'
  );

  // For some reason, there are times when the page isn't fully loaded
  // So I added an artifical delay here.
  await delay(6000);

  // debug statement for completing login
  if (debug) {
    await screenshot(page, `${dateTime}-login-completed.png`);
  }

  // store the HTML for true verification
  let bodyHTML = await page.evaluate(() => document.body.innerHTML);
  if (debug) {
    fs.writeFileSync(`debug/${dateTime}-page.html`, bodyHTML);
  }

  // properly logoff
  await page.waitForSelector('#page_bar_top > ul > li > a > #linkLogoff');
  await page.click('#page_bar_top > ul > li > a > #linkLogoff');

  await delay(2000);

  // debug statement for completing login
  if (debug) {
    await screenshot(page, `${dateTime}-logoff.png`);
  }

  await browser.close();
})();
