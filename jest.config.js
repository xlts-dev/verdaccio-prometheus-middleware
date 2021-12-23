module.exports = {
  name: 'verdaccio-prometheus-middleware',
  verbose: true,
  collectCoverage: true,
  collectCoverageFrom: ['src/**/*.ts', '!src/index.ts', '!src/types/*'],
  moduleFileExtensions: ['js', 'ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  reporters: ['default', ['jest-junit', { outputDirectory: './coverage/jest', outputName: 'results.xml' }]],
};
