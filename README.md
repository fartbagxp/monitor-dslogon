# Overview

This is a high level browser automated program for monitoring [DSLogon](https://www.dmdc.osd.mil/identitymanagement/profile/home.do) for uptime.

## Setup

- Install nvm to install nodejs.

- Install nodejs version 8 or above. `nvm install 8` or `nvm install 10`, and run `nvm use 8` or `nvm use 10`.

- Git clone the code.

- Run `npm install` to install all third party libraries.

(Note) I use vs-code with a prettier plugin (esbenp.prettier-vscode).

## How it works

[Puppeteer]() is a NodeJS library which provides a high level API to automate Google Chrome.
By using Puppeteer, we have the full ability of a browser experience while running headless.

With that, we can take screenshots and validate the HTML provided to ensure that end users experience are what we expect them to be.
