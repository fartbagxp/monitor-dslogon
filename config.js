const dotenv = require('dotenv');
dotenv.config();

/**
 * Ensure that the environment and credentials are set.
 */
const config = {};

config.validateEnv = () => {
  const url = process.env.url;
  const username = process.env.username;
  const password = process.env.password;
  const slackUrl = process.env.slack_webhook_url;
  const slackChannel = process.env.slack_channel;
  const slackUser = process.env.slack_user;
  const statuspageApiKey = process.env.statuspage_api_key;
  const statuspagePageId = process.env.statuspage_page_id;
  const statuspageUpdownMetricId = process.env.statuspage_metric_updown_id;
  const statuspageResponseMetricId =
    process.env.statuspage_metric_request_response_id;
  const statuspageLoginMetricId = process.env.statuspage_metric_login_id;
  const statuspageLoginLogoffMetricId =
    process.env.statuspage_metric_login_logoff_id;
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

  if (statuspageResponseMetricId == null || statuspageResponseMetricId === '') {
    console.warn(
      'No StatusPage.io Request/Response Metric ID has been set in environment.'
    );
    isStatusPageIOAvailable = false;
  }

  if (statuspageLoginMetricId == null || statuspageLoginMetricId === '') {
    console.warn(
      'No StatusPage.io Login Metric ID has been set in environment.'
    );
    isStatusPageIOAvailable = false;
  }

  if (
    statuspageLoginLogoffMetricId == null ||
    statuspageLoginLogoffMetricId === ''
  ) {
    console.warn(
      'No StatusPage.io Login/Logoff Metric ID has been set in environment.'
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
    responseMetricId: statuspageResponseMetricId,
    loginMetricId: statuspageLoginMetricId,
    loginLogoffMetricId: statuspageLoginLogoffMetricId,
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
};

module.exports = config;
