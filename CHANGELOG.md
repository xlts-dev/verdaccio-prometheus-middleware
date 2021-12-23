# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## 1.0.0 (2021-12-23)


### ⚠ BREAKING CHANGES

* **configuration:** configuration option `enabled` changed to `metricsEnabled`

### Features

* **metrics:** implement ability to collect default prometheus metrics ([001e8f8](https://github.com/xlts-dev/verdaccio-prometheus-middleware/commit/001e8f804c74e81cbc25e099b956ca2d0de65be6)), closes [#4](https://github.com/xlts-dev/verdaccio-prometheus-middleware/issues/4)
* **metrics:** Initial implementation of package install/download metrics capturing and metrics endpoint ([11e8ac6](https://github.com/xlts-dev/verdaccio-prometheus-middleware/commit/11e8ac6fc89c44531a5753d5b672276174972524))


### Bug Fixes

* **configuration:** configuration option `enabled` changed to `metricsEnabled` ([dbd0afe](https://github.com/xlts-dev/verdaccio-prometheus-middleware/commit/dbd0afeb4e009dd217e006555c8ab87a0bc6f4a9))
* **metrics:** fix issue where package download counters were not fully accurate ([97eb944](https://github.com/xlts-dev/verdaccio-prometheus-middleware/commit/97eb944f86dfc4c9a1c5ada3460986e92c0e8d01)), closes [#7](https://github.com/xlts-dev/verdaccio-prometheus-middleware/issues/7)
* **metrics:** Only collect metrics for download of tarball files. Metrics were previously collected for any GET request that looked like it was for a package.json or tarball install but this was less reliable as there were was no way to guarantee the request coming in was for an actual package.json (e.g. browser requests for favicon.ico). Also, Verdaccio would only hand off requests that generate a 401/403 to the middelware for non-tarball requests so metrics could be misleading. ([67caa0f](https://github.com/xlts-dev/verdaccio-prometheus-middleware/commit/67caa0f2e733966af9ece23ab649879378bd28e4))

# 0.1.0 (2021-12-23)


### Bug Fixes

* **metrics:** Only collect metrics for download of tarball files. Metrics were previously collected for any GET request that looked like it was for a package.json or tarball install but this was less reliable as there were was no way to guarantee the request coming in was for an actual package.json (e.g. browser requests for favicon.ico). Also, Verdaccio would only hand off requests that generate a 401/403 to the middelware for non-tarball requests so metrics could be misleading. ([67caa0f](https://github.com/xlts-dev/verdaccio-prometheus-middleware/commit/67caa0f2e733966af9ece23ab649879378bd28e4))


### Features

* **metrics:** Initial implementation of package install/download metrics capturing and metrics endpoint ([11e8ac6](https://github.com/xlts-dev/verdaccio-prometheus-middleware/commit/11e8ac6fc89c44531a5753d5b672276174972524))
