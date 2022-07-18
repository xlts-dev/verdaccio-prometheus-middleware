# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### 2.0.2 (2022-07-18)

### Build

- update all dependencies to latest

### 2.0.1 (2022-02-08)

### Documentation

- minor doc and code comment updates, update regenerate CHANGELOG for accuracy

### Build

- add `prepublishOnly` script to ensure that the source files are transpiled using the typescript compiler to the lib folder prior to publishing

## 2.0.0 (2022-02-03)

### ⚠ BREAKING CHANGES

- **metrics:** plugin configuration schema overhauled, default metric name of `registry_requests`
  renamed to `registry_package_downloads`

### Features

- **metrics:** collect http request metrics and package download metrics ([2cdebb9](https://github.com/xlts-dev/verdaccio-prometheus-middleware/commit/2cdebb93052605a47e2222a50a737df77a1548dd)), closes [#9](https://github.com/xlts-dev/verdaccio-prometheus-middleware/issues/9)

## 1.0.0 (2021-12-23)

### ⚠ BREAKING CHANGES

- **configuration:** configuration option `enabled` changed to `metricsEnabled`

### Features

- **metrics:** implement ability to collect default prometheus metrics ([49cc20b](https://github.com/xlts-dev/verdaccio-prometheus-middleware/commit/49cc20b937e0d82e2007eece60d0332eaca9c37b)), closes [#4](https://github.com/xlts-dev/verdaccio-prometheus-middleware/issues/4)
- **metrics:** Initial implementation of package install/download metrics capturing and metrics endpoint ([11e8ac6](https://github.com/xlts-dev/verdaccio-prometheus-middleware/commit/11e8ac6fc89c44531a5753d5b672276174972524))

### Bug Fixes

- **configuration:** configuration option `enabled` changed to `metricsEnabled` ([cc725e9](https://github.com/xlts-dev/verdaccio-prometheus-middleware/commit/cc725e9abbe4c8f1d81b145131747f1abf7f51d7))
- **metrics:** fix issue where package download counters were not fully accurate ([86546bf](https://github.com/xlts-dev/verdaccio-prometheus-middleware/commit/86546bf30eb007103bf343013e426150a73efb53)), closes [#7](https://github.com/xlts-dev/verdaccio-prometheus-middleware/issues/7)
- **metrics:** Only collect metrics for download of tarball files. Metrics were previously collected for any GET request that looked like it was for a package.json or tarball install but this was less reliable as there were was no way to guarantee the request coming in was for an actual package.json (e.g. browser requests for favicon.ico). Also, Verdaccio would only hand off requests that generate a 401/403 to the middelware for non-tarball requests so metrics could be misleading. ([67caa0f](https://github.com/xlts-dev/verdaccio-prometheus-middleware/commit/67caa0f2e733966af9ece23ab649879378bd28e4))

# 0.1.0 (2021-12-23)

### Bug Fixes

- **metrics:** Only collect metrics for download of tarball files. Metrics were previously collected for any GET request that looked like it was for a package.json or tarball install but this was less reliable as there were was no way to guarantee the request coming in was for an actual package.json (e.g. browser requests for favicon.ico). Also, Verdaccio would only hand off requests that generate a 401/403 to the middelware for non-tarball requests so metrics could be misleading. ([67caa0f](https://github.com/xlts-dev/verdaccio-prometheus-middleware/commit/67caa0f2e733966af9ece23ab649879378bd28e4))

### Features

- **metrics:** Initial implementation of package install/download metrics capturing and metrics endpoint ([11e8ac6](https://github.com/xlts-dev/verdaccio-prometheus-middleware/commit/11e8ac6fc89c44531a5753d5b672276174972524))
