# verdaccio-prometheus-middleware

A Prometheus metrics middleware plugin for Verdaccio v5. Collects several types of metrics and exposes them at a
configurable metrics endpoint (defaults to `/-/metrics`). The metrics are produced in the standard
[prometheus metrics text format](https://prometheus.io/docs/instrumenting/exposition_formats/#text-format-example).

## Table of contents

- [Metric Types](#metric-types)
  - [Prometheus Default Metrics](#prometheus-default-metrics)
  - [HTTP Request Metrics](#http-request-metrics)
  - [Package Download Metrics](#package-download-metrics)
- [Installation](#installation)
- [Configuration](#configuration)
- [Package Groups](#package-groups)
- [Contributing](#contributing)
  - [Pull Requests](#pull-requests)

### Metric Types

This plugin is capable of collecting three (3) different types of metrics. Further explanation is provided in the
sections below.

#### Prometheus Default Metrics

This plugin will collect default (standard) metrics when the `defaultMetrics.enabled` configuration option is set to
`true`. More information about default metrics can be found at:

- https://prometheus.io/docs/instrumenting/writing_clientlibs/#standard-and-runtime-collectors
- https://github.com/siimon/prom-client/tree/v14.0.1#default-metrics

#### HTTP Request Metrics

This plugin will collect metrics related to incoming HTTP requests when the `requestMetrics.enabled` configuration
option is set to `true`. A [counter](https://prometheus.io/docs/concepts/metric_types/#counter) metric is used to track
the number of HTTP requests. The following [labels](https://prometheus.io/docs/practices/naming/#labels) are applied to
_every_ request for this metric:

- `username` - The Verdaccio username of the user attempting to install/download a package. If the request is
  unauthenticated then the value `UNKNOWN` is used.
- `userAgentName` - The name of the user agent the client used to make the request. It is derived from the `user-agent`
  header on the request. If no `user-agent` header is provided it defaults to `UNKNOWN`.
- `httpMethod` - The HTTP method used in the request.
- `statusCode` - The status code of the response from Verdaccio.

#### Package Download Metrics

This plugin will collect metrics related to package tarball downloads when the `packageMetrics.enabled` configuration
option is set to `true`. A [counter](https://prometheus.io/docs/concepts/metric_types/#counter) metric is used to track
the number of package tarball installs/downloads. The following [labels](https://prometheus.io/docs/practices/naming/#labels)
are applied to _every_ request for this metric:

- `username` - The Verdaccio username of the user attempting to install/download a package. If the request is
  unauthenticated then the value `UNKNOWN` is used.
- `userAgentName` - The name of the user agent the client used to make the request. It is derived from the `user-agent`
  header on the request. If no `user-agent` header is provided it defaults to `UNKNOWN`.
- `statusCode` - The status code of the response from Verdaccio.

Optionally, an additional `packageGroup` label can be applied _if_ a `packageMetrics.packageGroups` option is added to
the plugin configuration. Refer to the [Package Groups](#package-groups) section of this README for more information.

### Installation

Because Verdaccio automatically prefixes the string `verdaccio-` to the directory it looks for when loading a plugin,
this plugin will need to be installed to a directory named `verdaccio-metrics` _IF_ your `middlewares` configuration
uses `metrics` as the configuration key for this plugin (as shown in the [Configuration](#configuration) example). Below
is an example `Dockerfile` that can be used to build a custom image containing this plugin. The Verdaccio
[`plugins`](https://verdaccio.org/docs/configuration#plugins) configuration option is assumed to be set to
`/verdaccio/plugins`.

```Dockerfile
# Docker multi-stage build - https://docs.docker.com/develop/develop-images/multistage-build/
# Use an alpine node image to install the plugin
FROM node:lts-alpine as builder

# Install the metrics middleware plugin
RUN mkdir -p /verdaccio/plugins \
    && cd /verdaccio/plugins \
    && npm install --global-style --no-bin-links --omit=optional @xlts.dev/verdaccio-prometheus-middleware@1.0.0

# The final built image will be based on the standard Verdaccio docker image.
FROM verdaccio/verdaccio:5.2.0

# Copy the plugin files over from the 'builder' node image.
# The `$VERDACCIO_USER_UID` env variable is defined in the base `verdaccio/verdaccio` image.
# Refer to: https://github.com/verdaccio/verdaccio/blob/v5.2.0/Dockerfile#L32
COPY --chown=$VERDACCIO_USER_UID:root --from=builder \
  /verdaccio/plugins/node_modules/@xlts.dev/verdaccio-prometheus-middleware \
  /verdaccio/plugins/verdaccio-metrics
```

### Configuration

Complete configuration example with comments:

```yaml
middlewares:
  metrics:
    ## Optional. Defaults to `/-/metrics`.
    metricsPath: /custom/path/metrics

    ## Optional. If not specified, no default metrics will be collected.
    ## Refer to: https://github.com/siimon/prom-client/tree/v14.0.1#default-metrics
    defaultMetrics:
      ## Optional. Defaults to `false`. Make sure to set this to `true` if you want to collect default metrics.
      enabled: true

    ## Optional. If not specified, no http request metrics will be collected.
    requestMetrics:
      ## Optional. Defaults to `false`. Make sure to set this to `true` if you want to collect request metrics.
      enabled: true

      ## Optional. Defaults to 'registry_http_requests'.
      metricName: 'registry_http_requests'

      ## Optional. An array of regular expressions used to match and exclude request paths. The default list of paths to
      ## exclude are shown below. If you override this array of values these default paths will NOT be included and will
      ## need to be added manually if you still wish to exclude them. The `metricsPath` is **ALWAYS** excluded.
      pathExclusions:
        - '^/$' # root path to web ui
        - '^/[-]/ping' # health endpoint
        - '^/[-]/(static|verdaccio|web)' # web ui related paths
        - '[.]ico$' # requests for icons (e.g. `favicon.ico`)

    ## Optional. If not specified, no package download metrics will be collected.
    packageMetrics:
      ## Optional. Defaults to `false`. Make sure to set this to `true` if you want to collect package download metrics.
      enabled: true

      ## Optional. Defaults to 'registry_package_downloads'.
      metricName: 'registry_package_downloads'

      ## Optional. A map of regular expressions to package grouping names.
      packageGroups:
        ## NOTE: The order of items below matters. The first matched regex is the package grouping that will be applied
        ## to the metric generated for a request.
        '@angular/[^/]*': angular
        'react': react
        '.*': other
```

### Package Groups

The `packageMetrics.packageGroups` configuration option accepts an object map whose keys are expected to be a regular
expression string and the value the name of the package group that should be used for the `packageGroup` metric label.
If no `packageMetrics.packageGroups` are defined, a `packageGroup` [label](https://prometheus.io/docs/practices/naming/#labels)
will NOT be applied to the `packageMetrics` [counter](https://prometheus.io/docs/concepts/metric_types/#counter) metric.

The regular expression key is evaluated against the request path in the following manner:

```javascript
// scoped packages generally have the `/` url encoded to `%2f`
new RegExp(packageGroupRegex).test(decodeURIComponent(request.path));
```

The order of the keys/values in the object map matters. The regular expressions are evaluated from first to last in the
order they are listed under the `packageMetrics.packageGroups` configuration option and the first matching regex will
have the corresponding package grouping value applied when the `packageMetrics` counter metric is collected.

Given the following example configuration:

```yaml
# Verdaccio config file
middlewares:
  metrics:
    packageMetrics:
      enabled: true
      packageGroups:
        '@babel/plugin': 'babel-plugin'
        'babel[-]plugin': 'babel-plugin'
        'babel': 'babel'
        '@.*': scoped
        '.*': other
```

... the following packages would resolve to the `packageGroup` as listed in the table:

| Package Name                      | Package Group |
| --------------------------------- | ------------- |
| `@babel/core`                     | babel         |
| `@babel/parser`                   | babel         |
| `@babel/plugin-transform-runtime` | babel-plugin  |
| `babel-plugin-istanbul`           | babel-plugin  |
| `babel-jest`                      | babel         |
| `@angular/core`                   | scoped        |
| `@apollo/client`                  | scoped        |
| `react`                           | other         |
| `apollo-server-express`           | other         |

### Contributing

This project enforces the [Angular commit message format](https://github.com/angular/angular/blob/13.1.1/CONTRIBUTING.md#-commit-message-format).

A [husky](https://typicode.github.io/husky/#/) `prepare-commit-msg` hook is used in conjunction with
[commitzen](https://github.com/commitizen/cz-cli) in order to automatically prompt for all required fields in the
commit message. The `commitzen` prompts can be bypassed and the commit message may still manually be created by
interrupting the `commitzen` prompt using `ctrl+c`. A valid commit message is still required as each commit message
is linted using [commitlint](https://commitlint.js.org/#/) and a [husky](https://typicode.github.io/husky/#/)
`commit-msg` hook to ensure the [Angular commit message format](https://github.com/angular/angular/blob/13.1.1/CONTRIBUTING.md#-commit-message-format)
is followed.

#### Pull Requests

Prior to opening a pull request, please ensure that you run the command:

```bash
npm run release
```

This will automatically increment the version number in the `package.json` based on the types of commits contained in
the pull request and update the `CHANGELOG.md` appropriately. If a specific version type needs to be forced, the same
command can be executed with an argument passed:

```bash
# force incrementing to a new major version
npm run release -- -r major
```
