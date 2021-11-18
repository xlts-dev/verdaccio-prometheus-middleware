# verdaccio-metrics-middleware
Metrics middleware plugin for Verdaccio. Collects metrics specifically for package tarball install/download requests and
exposes them at a configurable metrics endpoint (defaults to `/-/metrics`). The metrics are produced in the standard
[prometheus metrics text format](https://prometheus.io/docs/instrumenting/exposition_formats/#text-format-example).

A [counter](https://prometheus.io/docs/concepts/metric_types/#counter) metric is used to track the number of package
tarball installs/downloads. The following [labels](https://prometheus.io/docs/practices/naming/#labels) are applied to
_every_ request:
- `username` - The Verdaccio username of the user attempting to install/download a package. If the request is
  unauthenticated then the value `UNKNOWN` is used.
- `userAgentName` - The name of the user agent the client used to make the request. It is derived from the `user-agent`
  header on the request. If no `user-agent` header is provided it defaults to `UNKNOWN`.
- `statusCode` - The status code of the response from Verdaccio.

Optionally, an additional `packageGroup` label can be applied *if* a `packageGroups` option is added to the plugin
configuration.

## Configuration
Complete configuration example:
```yaml
middlewares:
  metrics:
    ## Optional. Defaults to `false` so make sure to set this to `true` if you want to collect metrics.
    enabled: true

    ## Optional. Defaults to `/-/metrics`.
    metricsPath: /custom/path/metrics

    ## Optional. A map of regular expressions to package grouping names.
    packageGroups:
      ## NOTE: The order of items below matters. The first matched regex is the package grouping that will be applied
      ## to the metric generated for a request.
      '@angular[/][^/]*': angular
      'react': react
      '.*': other
```

## Package Groups
The `packageGroups` configuration option accepts an object map whose keys are expected to be a regular expression string
and the value the name of the package group that should be used for the `packageGroup` metric label. If no
`packageGroups` are defined, a `packageGroup` [label](https://prometheus.io/docs/practices/naming/#labels) will NOT be
applied to the [counter](https://prometheus.io/docs/concepts/metric_types/#counter) metric.

The regular expression key is evaluated against the request path in the following manner:
```javascript
// scoped packages generally have the `/` url encoded to `%2f`
new RegExp(packageGroupRegex).test(decodeURIComponent(request.path))
```

The order of the keys/values in the object map matters. The regular expressions are evaluated from first to last in the
order they are listed under the `packageGroups` configuration option and the first matching regex will have the
corresponding package grouping value applied when the install/download counter metric is collected.

Given the following example configuration:
```yaml
# Verdaccio config file
middlewares:
  metrics:
    enabled: true
    packageGroups:
      '@babel[/]plugin': 'babel-plugin'
      'babel[-]plugin': 'babel-plugin'
      'babel': 'babel'
      '@.*': scoped
      '.*': other
```
... the following packages would resolve to the `packageGroup` as listed in the table:

| Package Name                      | Package Group |
|-----------------------------------|---------------|
| `@babel/core`                     | babel         |
| `@babel/parser`                   | babel         |
| `@babel/plugin-transform-runtime` | babel-plugin  |
| `babel-plugin-istanbul`           | babel-plugin  |
| `babel-jest`                      | babel         |
| `@angular/core`                   | scoped        |
| `@apollo/client`                  | scoped        |
| `react`                           | other         |
| `apollo-server-express`           | other         |
