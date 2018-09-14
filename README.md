<br></br>
[![styled with prettier](https://img.shields.io/badge/styled_with-prettier-ff69b4.svg)](https://github.com/prettier/prettier)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)
[![MIT License](https://img.shields.io/github/license/dawnlabs/carbon.svg)](https://github.com/dawnlabs/carbon/blob/master/LICENSE)

# Overview

This is a high level browser automated program for monitoring [DSLogon](https://www.dmdc.osd.mil/identitymanagement/profile/home.do) for uptime.

## Setup for development

- Instructions to install NodeJS version manager, [nvm](https://github.com/creationix/nvm).

- Install [nodejs](https://nodejs.org/en/) version 8 or above by running:

  - `nvm install 8` or `nvm install 10`
  - `nvm use 8` or `nvm use 10`.

- Git clone the code: `git clone git@github.com:fartbagxp/monitor-dslogon.git`.

- Install all third party libraries: `npm install`.

  - This includes a headless Chrome browser for [Puppeteer](https://github.com/GoogleChrome/puppeteer).

- Copy `.env.sample` to `.env`: `cp .env.sample .env`.

- Fill out the environment variables in the `.env` file.

## Editor Choice

I use [vs-code](https://code.visualstudio.com/) with a [prettier extension](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode).

## How it works

[Puppeteer](https://github.com/GoogleChrome/puppeteer) is a NodeJS library which provides a high level API to automate Google Chrome.
By simulating Chrome, we have the full ability of a user's browser experience when logging in.

## Verification on whether DSLogon is up or down

1. We take screenshots and validate the HTML provided to ensure that end users experience are what we expect them to be.

   - You can try this by running `npm run start-dev`, and the resulting screenshot and HTML will appear in the `debug` folder.

1. We also verify the HTML for correctness, by verifying certain key terms such as `logged in`, to verify that the user has been logged in properly.

1. We should verify that all HTTP request calls were completely properly, and that no error was captured in the Chrome console.
