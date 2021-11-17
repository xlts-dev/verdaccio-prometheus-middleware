import chanceJs from 'chance';

import { AuthType, getUserAgentData, getUsername, UNKNOWN } from '../src/utils';

import { generateMockBasicAuth, generateMockBearerAuth, getLogger } from './testUtils';

const chance = chanceJs();

const userAgentNameTestCases = [
  { userAgentName: UNKNOWN, userAgentVersion: undefined, userAgentString: '' },
  { userAgentName: UNKNOWN, userAgentVersion: undefined, userAgentString: undefined },
  { userAgentName: 'pnpm', userAgentVersion: undefined, userAgentString: 'pnpm' },
  // prettier-ignore
  { userAgentName: 'Nexus', userAgentVersion: '3.32.0-03', userAgentString: 'Nexus/3.32.0-03 (OSS; Linux; 5.4.0-1055-azure; amd64' },
  { userAgentName: 'Artifactory', userAgentVersion: '6.18.0', userAgentString: 'Artifactory/6.18.0' },
  { userAgentName: 'Artifactory', userAgentVersion: '7.25.6', userAgentString: 'Artifactory/7.25.6 72506900' },
  { userAgentName: 'npm', userAgentVersion: '6.14.11', userAgentString: 'npm/6.14.11 node/v12.20.1 win32 ia32' },
  // prettier-ignore
  { userAgentName: 'npm', userAgentVersion: '7.20.5', userAgentString: 'npm/7.20.5 node/v14.17.1 darwin x64 workspaces/false' },
  // prettier-ignore
  { userAgentName: 'npm', userAgentVersion: '8.1.0', userAgentString: 'npm/8.1.0 node/v17.0.1 darwin x64 workspaces/false' },
  { userAgentName: 'typesInstaller', userAgentVersion: '4.2.4', userAgentString: 'typesInstaller/4.2.4' },
  // prettier-ignore
  { userAgentName: 'got', userAgentVersion: '6.7.1', userAgentString: 'got/6.7.1 (https://github.com/sindresorhus/got)' },
  // prettier-ignore
  { userAgentName: 'dependabot-core', userAgentVersion: '0.164.1', userAgentString: 'dependabot-core/0.164.1 excon/0.88.0 ruby/2.7.1 (x86_64-linux-gnu)' },
  { userAgentName: 'curl', userAgentVersion: '7.68.0', userAgentString: 'curl/7.68.0' },
  // Parsing of web browser user agent strings will almost always result in:
  //   `{ userAgentName: 'Mozilla', userAgentVersion: '5.0' }`
  // A library could be used to better determine the actual browser but has been deemed unnecessary since a customer
  // should never being making requests for packages using a browser.
  {
    userAgentName: 'Mozilla',
    userAgentVersion: '5.0',
    // prettier-ignore
    userAgentString: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.69 Safari/537.36',
  },
];

describe('User agent string parsing', () => {
  userAgentNameTestCases.forEach(({ userAgentName, userAgentVersion, userAgentString }) => {
    test(`should parse the user agent string '${userAgentString}'`, () => {
      expect(getUserAgentData(getLogger(), userAgentString)).toEqual({ userAgentName, userAgentVersion });
    });
  });
});

const usernameTestCases = [
  { username: UNKNOWN, authType: undefined, authHeader: '' },
  { username: UNKNOWN, authType: undefined, authHeader: undefined },
  { username: UNKNOWN, authType: undefined, authHeader: null },
  { username: UNKNOWN, authType: undefined, authHeader: chance.word() },
  { username: UNKNOWN, authType: undefined, authHeader: `Bearer ${chance.word()}.${chance.word()}.${chance.word()}` },
  { username: UNKNOWN, authType: undefined, authHeader: `Basic ${chance.word()}` },
  { username: 'user_bearer', authType: AuthType.jwt, authHeader: generateMockBearerAuth('user_bearer') },
  { username: 'user_basic', authType: AuthType.password, authHeader: generateMockBasicAuth('user_basic') },
];

describe('Username parsing', () => {
  usernameTestCases.forEach(({ username, authType, authHeader }) => {
    test(`should parse the username from auth header '${authHeader}'`, () => {
      expect(getUsername(getLogger(), authHeader)).toEqual({ username, authType });
    });
  });
});
