const s = {};

/**
 * A quick way of monitoring via slack for now.
 */
s.notifySlack = async function(slack, errorText, timeinSec) {
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
};

module.exports = s;
