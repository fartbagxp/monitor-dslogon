const request = require('superagent');

/**
 * This is the statuspage.io API for metrics.
 * For more: https://doers.statuspage.io/api/v1/metrics/
 *
 * @param {Object} creds Credentials for API metrics
 */
const statuspage = creds => {
  /**
   * Handle different error codes from statuspage.io
   *
   * @param {Object} res Response object from statuspage.io
   */
  function handleResponse(res) {
    if (res.status) {
      switch (res.status) {
        case 201: // response accepted
          break;
        case 202: // batch accepted, will be queued for processing
          break;
        case 403:
          console.error(
            `Statuspage.io API returns ${
              res.status
            }: Metric not found for ID, or submitted too many data points: ${data}`
          );
          break;
        case 405:
          console.error(
            `Statuspage.io API returns ${
              res.status
            }: Data cannot be submitted for this type of metric on provided data: ${data}`
          );
          break;
        case 422:
          console.error(
            `Statuspage.io API returns ${
              res.status
            }: Validation error on provided data: ${data}`
          );
          break;
        default:
          console.error(
            `Statuspage.io API returns ${
              res.status
            }: Unknown error on provided data: ${data}`
          );
      }
    }
  }

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
        handleResponse(res);
      })
      .catch(err => {
        console.error(JSON.stringify(err));
      });
  };

  /**
   * Utilize the API to post all metrics to the status page.
   *
   * @param {Integer} upOrDown The up or down (1 or 0) value
   * @param {float} loginResponseTimeInMs The time taken for a user to login (from request/response)
   * @param {float} loginTimeInMs The time taken for a user to login with page load
   * @param {float} totalTimeTakenInMs The time taken for a user to login, auth, and logoff
   */
  const postMetrics = (
    upOrDown,
    loginResponseTimeInMs,
    loginTimeInMs,
    totalTimeTakenInMs
  ) => {
    if (creds == null) {
      return;
    }

    const data = {};
    const timestamp = Math.floor(new Date() / 1000);
    data[creds.responseMetricId] = [
      {
        timestamp: timestamp,
        value: loginResponseTimeInMs
      }
    ];
    data[creds.loginMetricId] = [
      {
        timestamp: timestamp,
        value: loginTimeInMs
      }
    ];
    data[creds.loginLogoffMetricId] = [
      {
        timestamp: timestamp,
        value: totalTimeTakenInMs
      }
    ];
    data[creds.updownMetricId] = [
      {
        timestamp: timestamp,
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
        handleResponse(res);
      })
      .catch(err => {
        console.error(JSON.stringify(err));
      });
  };

  return {
    postUpDownMetric: postUpDownMetric,
    postMetrics: postMetrics
  };
};

module.exports = statuspage;
