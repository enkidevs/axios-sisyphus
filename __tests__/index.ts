import axios from 'axios';
import * as sisyphus from '../src/index';
jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

const okResponse = {
  status: 200,
  data: {
    ok: true,
  },
};

const failResponse = {
  status: 400,
  data: {
    ok: false,
  },
};

type R = {
  ok: boolean;
};

describe('behavior', () => {
  test('should return after first successful request', async () => {
    mockedAxios.request.mockImplementationOnce(async () => okResponse);

    const response = await sisyphus.request<R>({ retries: 1 });
    expect(response).toBeTruthy();
    expect(response).toMatchObject(okResponse);
  });

  test('should return after a successful request within the retries boundary', async () => {
    mockedAxios.request
      .mockImplementationOnce(async () => {
        throw failResponse;
      })
      .mockImplementationOnce(async () => okResponse);

    const response = await sisyphus.request<R>({ retries: 2 });
    expect(response).toBeTruthy();
    expect(response).toMatchObject(okResponse);
  });

  test('should reject if all retries were unsuccessful and return all errors', async () => {
    mockedAxios.request
      .mockImplementationOnce(async () => {
        throw failResponse;
      })
      .mockImplementationOnce(async () => {
        throw failResponse;
      });

    await expect(
      sisyphus.request<R>({ retries: 2 }),
    ).rejects.toMatchObject({
      errors: expect.objectContaining({
        0: expect.objectContaining(failResponse),
        1: expect.objectContaining(failResponse),
      }),
    });
  });
  test('should reject if a successful request matches isResponseFailed ', async () => {
    mockedAxios.request.mockImplementationOnce(async () => failResponse);

    await expect(
      sisyphus.request<R>({
        retries: 1,
        responseFailedFilter: async (response) => !response.data.ok,
      }),
    ).rejects.toMatchObject({
      errors: expect.objectContaining({
        0: expect.objectContaining(failResponse),
      }),
    });
  });

  test('should invoke callback after each failed iteration', async () => {
    const failedIterationCallback = jest.fn();

    mockedAxios.request
      .mockImplementationOnce(async () => {
        throw failResponse;
      })
      .mockImplementationOnce(async () => {
        throw failResponse;
      })
      .mockImplementationOnce(async () => {
        throw failResponse;
      });

    await expect(
      sisyphus.request({ retries: 3, failedIterationCallback }),
    ).rejects.toBeDefined();
    expect(failedIterationCallback).toHaveBeenCalledTimes(3);
    expect(failedIterationCallback).toHaveBeenCalledWith(0);
    expect(failedIterationCallback).toHaveBeenCalledWith(1);
    expect(failedIterationCallback).toHaveBeenCalledWith(2);
  });
});

describe('shortcuts', () => {
  test('default export should point to request method', async () => {
    expect(sisyphus.default).toBe(sisyphus.request);
  });
  test('alias calls should call axios request with the right method', async () => {
    const methods = [
      'get',
      'head',
      'patch',
      'options',
      'post',
      'put',
      'delete',
    ];

    for (const method of methods) {
      mockedAxios.request.mockImplementationOnce(async () => okResponse);
      await sisyphus[method]<R>({}, {});
      expect(mockedAxios.request).toHaveBeenCalledWith({
        method: method.toUpperCase(),
      });
    }
  });
});
