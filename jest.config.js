module.exports = {
  name: 'verdaccio-metrics-middleware',
  verbose: true,
  collectCoverage: true,
  collectCoverageFrom: ['src/**/*.ts', '!src/index.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
  },
  reporters: ['default', ['jest-junit', { outputDirectory: './coverage/jest', outputName: 'results.xml' }]],
};
