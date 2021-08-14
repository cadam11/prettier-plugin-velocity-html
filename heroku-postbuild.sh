#!/usr/bin/env bash

set -ex
BUILD_STANDALONE=true npm run build:production
cd website/ 
export
# Install devDependencies, but skip webpackDevServer it does not install during Heroku build.
# npm ci fails with `node-pre-gyp not accessible from fsevents`
NODE_ENV=dev npm_config_production=false npm install --no-optional
pwd
ls node_modules/
cat package-lock.json
./node_modules/.bin/webpack --mode production