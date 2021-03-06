/**
 * Copyright 2019 The AMP HTML Authors. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS-IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const file = require('gulp-file');
const fs = require('fs-extra');
const gulp = require('gulp');
const gulpWatch = require('gulp-watch');
const {buildExtensions, extensions} = require('./extension-helpers');
const {endBuildStep, mkdirSync, toPromise} = require('./helpers');
const {jsifyCssAsync} = require('./jsify-css');
const {maybeUpdatePackages} = require('./update-packages');

/**
 * Entry point for 'gulp css'
 * @return {!Promise}
 */
async function css() {
  maybeUpdatePackages();
  return compileCss();
}

const cssEntryPoints = [
  {
    path: 'ampdoc.css',
    outJs: 'ampdoc.css.js',
    outCss: 'v0.css',
  },
  {
    path: 'ampshared.css',
    outJs: 'ampshared.css.js',
    outCss: 'v0.css',
    append: true,
  },
  {
    path: 'video-autoplay.css',
    outJs: 'video-autoplay.css.js',
    // When the .css.js files are imported, the .js extension is omitted
    // e.g. '../../build/file.css' attempts to load 'build/file.css.js'
    // but if a file which matches without the .js extension, it will
    // be preferred. We should rename the out.css to have a different name
    // than the JS file to avoid loading CSS as JS
    outCss: 'video-autoplay-out.css',
  },
  {
    // Publisher imported CSS for `src/amp-story-player.js`.
    path: 'amp-story-player.css',
    outJs: 'amp-story-player.css.js',
    outCss: 'amp-story-player-v0.css',
  },
  {
    // Internal CSS used for the iframes inside `src/amp-story-player.js`.
    path: 'amp-story-player-iframe.css',
    outJs: 'amp-story-player-iframe.css.js',
    outCss: 'amp-story-player-iframe-v0.css',
  },
];

/**
 * Compile all the css and drop in the build folder
 * @param {boolean} watch
 * @return {!Promise}
 */
function compileCss(watch) {
  if (watch) {
    gulpWatch('css/**/*.css', function() {
      compileCss();
    });
  }

  /**
   * Writes CSS to build folder
   *
   * @param {string} css
   * @param {string} jsFilename
   * @param {string} cssFilename
   * @param {boolean} append append CSS to existing file
   * @return {Promise}
   */
  function writeCss(css, jsFilename, cssFilename, append) {
    return toPromise(
      file(
        jsFilename,
        '/** @noinline */ export const cssText = ' + JSON.stringify(css),
        {
          src: true,
        }
      )
        .pipe(gulp.dest('build'))
        .on('end', function() {
          mkdirSync('build');
          mkdirSync('build/css');
          if (append) {
            fs.appendFileSync(`build/css/${cssFilename}`, css);
          } else {
            fs.writeFileSync(`build/css/${cssFilename}`, css);
          }
        })
    );
  }

  /**
   * @param {string} path
   * @param {string} outJs
   * @param {string} outCss
   * @param {boolean} append
   * @return {!Promise}
   */
  function writeCssEntryPoint(path, outJs, outCss, append) {
    return jsifyCssAsync(`css/${path}`).then(css =>
      writeCss(css, outJs, outCss, append)
    );
  }

  const startTime = Date.now();

  // Used by `gulp unit --local_changes` to map CSS files to JS files.
  fs.writeFileSync('EXTENSIONS_CSS_MAP', JSON.stringify(extensions));

  let promise = Promise.resolve();

  cssEntryPoints.forEach(entryPoint => {
    const {path, outJs, outCss, append} = entryPoint;
    promise = promise.then(() =>
      writeCssEntryPoint(path, outJs, outCss, append)
    );
  });

  return promise
    .then(() => buildExtensions({compileOnlyCss: true}))
    .then(() => {
      endBuildStep('Recompiled all CSS files into', 'build/', startTime);
    });
}

module.exports = {
  css,
  compileCss,
  cssEntryPoints,
};

css.description = 'Recompile css to build directory';
