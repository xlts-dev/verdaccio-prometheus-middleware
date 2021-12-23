# 0.1.0 (2021-12-23)


### Bug Fixes

* **metrics:** Only collect metrics for download of tarball files. Metrics were previously collected for any GET request that looked like it was for a package.json or tarball install but this was less reliable as there were was no way to guarantee the request coming in was for an actual package.json (e.g. browser requests for favicon.ico). Also, Verdaccio would only hand off requests that generate a 401/403 to the middelware for non-tarball requests so metrics could be misleading. ([67caa0f](https://github.com/xlts-dev/verdaccio-prometheus-middleware/commit/67caa0f2e733966af9ece23ab649879378bd28e4))


### Features

* **metrics:** Initial implementation of package install/download metrics capturing and metrics endpoint ([11e8ac6](https://github.com/xlts-dev/verdaccio-prometheus-middleware/commit/11e8ac6fc89c44531a5753d5b672276174972524))



