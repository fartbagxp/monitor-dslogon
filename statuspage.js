const request = require('superagent');

/**
 * This is the statuspage.io API for metrics.
 * For more: https://doers.statuspage.io/api/v1/metrics/
 *
 * @param {Object} creds Credentials for API metrics
 */
const statuspage = creds => {
  /**
   * Utilize the API to post results to the status page.
   *
   * @param {float} upOrDown The time taken for a user to login, auth, and logoff
   */
  const postUpDownMetric = upOrDown => {
    if (creds == null) {
      return;
    }

    const data = {
      timestamp: Math.floor(new Date() / 1000),
      value: upOrDown
    };
    request
      .post(
        `https://${creds.apiBase}/v1/pages/${creds.pageId}/metrics/${
          creds.updownMetricId
        }/data.json`
      )
      .set('Authorization', `OAuth ${creds.apiKey}`)
      .send({ data })
      .then(res => {
        console.log(JSON.stringify(res));
      });
  };

  /**
   * Utilize the API to post all metrics to the status page.
   *
   * @param {Integer} upOrDown The up or down (1 or 0) value
   * @param {float} timeTakenInMs The time taken for a user to login, auth, and logoff
   */
  const postMetrics = (upOrDown, timeTakenInMs) => {
    if (creds == null) {
      return;
    }

    const data = {};
    data[creds.loginMetricId] = [
      {
        timestamp: Math.floor(new Date() / 1000),
        value: timeTakenInMs
      }
    ];
    data[creds.updownMetricId] = [
      {
        timestamp: Math.floor(new Date() / 1000),
        value: upOrDown
      }
    ];

    request
      .post(
        `https://${creds.apiBase}/v1/pages/${creds.pageId}/metrics/data.json`
      )
      .set('Authorization', `OAuth ${creds.apiKey}`)
      .send({ data })
      .then(res => {
        console.log(JSON.stringify(res));
      });
  };

  return {
    postUpDownMetric: postUpDownMetric,
    postMetrics: postMetrics
  };
};

module.exports = statuspage;
