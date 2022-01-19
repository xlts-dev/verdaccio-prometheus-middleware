import { Logger } from '@verdaccio/types';

export const UNKNOWN = 'UNKNOWN';

export enum AuthType {
  jwt = 'jwt',
  password = 'password',
}

/**
 * Attempt to parse an 'authorization' header string and derive the Verdaccio username.
 * @param {Logger} logger - The Verdaccio pino logger instance.
 * @param {string} authHeader - The 'authorization' header string. The auth header is expected to be either:
 *   - Basic authentication format.
 *     Refer to: https://developer.mozilla.org/en-US/docs/Web/HTTP/Authentication#basic_authentication_scheme
 *   - Bearer token format of `Bearer <base64_header>.<base64_payload>.<base64_signature>`.
 *     Refer to: https://jwt.io/introduction
 * @return {{ username: string, authType: string|undefined }} - The Verdaccio username or the string 'UNKNOWN' if it
 *  could not be derived.
 */
export function getUsername(
  logger: Logger,
  authHeader: string | null | undefined,
): { username: string; authType: string | undefined } {
  if (!authHeader || typeof authHeader !== 'string' || !authHeader.length) {
    logger.debug({ authHeader }, 'metrics: [getUsername] authorization header string is not present or is invalid');
    return { username: UNKNOWN, authType: undefined };
  }
  try {
    const [authType, authValue] = authHeader.split(' ');
    switch (authType.toLowerCase().trim()) {
      case 'bearer':
        const jwt = JSON.parse(Buffer.from(authValue.split('.')[1], 'base64').toString('utf8'));
        const { name = UNKNOWN } = jwt;
        return { username: name, authType: AuthType.jwt };
      case 'basic':
        const username = Buffer.from(authValue.trim(), 'base64').toString('utf8').split(':').shift() || UNKNOWN;
        // The username is valid if it contains only ASCII characters. This covers the test case where the value is a
        // NON base 64 encoded string.
        const usernameValid = /^[\x00-\x7F]*$/.test(username); // eslint-disable-line no-control-regex
        return {
          username: usernameValid ? username : UNKNOWN,
          authType: usernameValid ? AuthType.password : undefined,
        };
      default:
        return { username: UNKNOWN, authType: undefined };
    }
  } catch (error) {
    // debug message as other log messages exist to indicate the authorization header was not valid
    logger.debug(`metrics: [getUsername] error parsing authorization header`);
    return { username: UNKNOWN, authType: undefined };
  }
}

/**
 * Attempt to parse the 'user-agent' header string and derive the agent name and agent version.
 * @param {Logger} logger - The Verdaccio pino logger instance.
 * @param {string} userAgentHeader - The 'user-agent' header string. Example user agent header:
 *  'npm/7.20.5 node/v14.17.1 darwin x64 workspaces/false'.
 * @return {{ userAgentName: string, userAgentVersion: string|undefined }} - The name/version of the agent or the string
 *  'UNKNOWN' for the agent name if it could not be derived.
 */
export function getUserAgentData(
  logger: Logger,
  userAgentHeader: string | null | undefined,
): { userAgentName: string; userAgentVersion: string | undefined } {
  if (!userAgentHeader || typeof userAgentHeader !== 'string' || !userAgentHeader.length) {
    logger.debug(
      { userAgentHeader },
      'metrics: [getUserAgentData] user agent header string is not present or is invalid',
    );
    return { userAgentName: UNKNOWN, userAgentVersion: undefined };
  }
  const [userAgentName] = userAgentHeader.split(/[^\w-]/);
  const [userAgentVersion] = userAgentHeader.match(/(\d+[-_]?\d*[.]?){2,4}/) || [];
  logger.debug({ userAgentName, userAgentVersion }, 'metrics: [getUserAgentData] parsed user agent header');
  return { userAgentName, userAgentVersion };
}
