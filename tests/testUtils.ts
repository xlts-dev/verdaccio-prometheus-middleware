/* eslint-disable @typescript-eslint/ban-types,@typescript-eslint/no-explicit-any,no-invalid-this */
import chanceJs from 'chance';
import { Logger } from '@verdaccio/types';
import { Request, Response, NextFunction } from 'express';

import { AuthType } from '../src/utils';

const chance = chanceJs();

export const INVALID_AUTHORIZATION = 'INVALID';

export const getLogger = (): Logger => ({
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  child: jest.fn(),
  warn: jest.fn(),
  http: jest.fn(),
  trace: jest.fn(),
});

interface MockRequestOptions {
  authType?: AuthType;
  username?: string;
  userAgentName?: string;
  userAgentVersion?: string;
  httpMethod?: string;
  path?: string;
}

export function getRequestOptions({
  authType = AuthType.jwt,
  username,
  userAgentName,
  userAgentVersion,
  httpMethod = 'GET',
  path = `/${chance.word()}/${chance.word()}`,
}: MockRequestOptions = {}) {
  return {
    authType,
    username,
    userAgentString: userAgentName ? userAgentName + (userAgentVersion ? `/${userAgentVersion}` : '') : undefined,
    httpMethod,
    path,
  } as MockRequestParams;
}

interface MockRequestParams {
  authType: AuthType;
  username?: string;
  userAgentString?: string;
  httpMethod: string;
  path: string;
}

export function generateMockRequest(
  { authType, username, userAgentString, httpMethod, path }: MockRequestParams = getRequestOptions(),
  invalidAuth = false,
) {
  const authHeader = (() => {
    switch (true) {
      case invalidAuth:
        return INVALID_AUTHORIZATION;
      case !!username && authType === AuthType.jwt:
        return generateMockBearerAuth(username);
      case !!username && authType === AuthType.password:
        return generateMockBasicAuth(username);
      default:
        return undefined;
    }
  })();
  return {
    method: httpMethod,
    path,
    headers: {
      Authorization: authHeader,
      'User-Agent': userAgentString,
    },
    header: function (headerName) {
      // @ts-ignore
      const headers = Object.entries(this.headers).reduce(
        (acc, [header, value]) => ({ ...acc, [header.toLowerCase()]: value }),
        {},
      );
      return headers[headerName.toLowerCase()];
    },
  };
}

export function generateMockResponse() {
  const mockResponse = {
    statusCode: 999,
    finish: jest.fn(),
    setHeader: jest.fn(),
    status: jest.fn(),
    send: jest.fn(),
    once: jest.fn().mockImplementation(function (eventName, handler: any) {
      if (eventName === 'close') {
        mockResponse.statusCode = 200;
        mockResponse.finish.mockImplementation(handler);
      }
    }),
  };
  return mockResponse;
}

export function getExpressMocks(mockRequestParams: MockRequestParams = getRequestOptions(), invalidAuth?: boolean) {
  const req: Request = generateMockRequest(mockRequestParams, invalidAuth) as unknown as Request;
  const res: Response & { finish: any } = generateMockResponse() as unknown as Response & { finish: any };
  // When `next()` is called automatically call through to the response `finish()` callback.
  const next: NextFunction = jest.fn().mockImplementationOnce(res.finish);
  return { req, res, next };
}

export function generateMockBearerAuth(username) {
  return [
    'Bearer ',
    chance.word(),
    '.',
    Buffer.from(JSON.stringify({ name: username })).toString('base64'),
    '.',
    chance.word(),
  ].join('');
}

export function generateMockBasicAuth(username) {
  return ['Basic ', Buffer.from(`${username}:${chance.word()}`).toString('base64')].join('');
}
