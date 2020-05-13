import axios, {
  AxiosRequestConfig,
  Method,
  AxiosResponse,
  AxiosError,
} from 'axios';

type Config<R = any> = {
  retries?: number;
  responseFailedFilter?: (response: AxiosResponse<R>) => Promise<boolean>;
  failedIterationCallback?: (index: number) => Promise<void>;
};

type ErrorList<R = any> = Error & {
  errors: Array<AxiosError | AxiosResponse<R>>;
};

type Result<R> = Promise<AxiosResponse<R>>;

const DEFAULTS = {
  retries: 1,
  responseFailedFilter: (): boolean => false,
  iterationCallback: async (): Promise<void> => {
    return;
  },
};

async function request<R = any>(
  config: Config<R> = {},
  axiosConfig: AxiosRequestConfig = {},
): Result<R> {
  const {
    retries = DEFAULTS.retries,
    responseFailedFilter = DEFAULTS.responseFailedFilter,
    failedIterationCallback = DEFAULTS.iterationCallback,
  } = config;

  const iterations = [...Array(retries)].map((_, index) => index);
  const errors = [];

  for (const iteration of iterations) {
    try {
      const response = await axios.request<R>(axiosConfig);
      if (await responseFailedFilter(response)) {
        throw response;
      }
      return response;
    } catch (err) {
      errors.push(err);
      await failedIterationCallback(iteration);
      if (iteration + 1 === retries) {
        const errorToThrow = new Error(
          `Failed to successfully request ${axiosConfig.url} within ${config.retries} attempts.`,
        ) as ErrorList<R>;
        errorToThrow.errors = errors;
        throw errorToThrow;
      }
    }
  }
}

function methodWrapper(method: Method) {
  return <R = any>(
    config: Config<R>,
    axiosConfig: Omit<AxiosRequestConfig, 'method'>,
  ): Result<R> =>
    request(config, {
      ...axiosConfig,
      method,
    });
}

const get = methodWrapper('GET');
const patch = methodWrapper('PATCH');
const head = methodWrapper('HEAD');
const options = methodWrapper('OPTIONS');
const post = methodWrapper('POST');
const put = methodWrapper('PUT');
const _delete = methodWrapper('DELETE');

export {
  request,
  request as default,
  get,
  patch,
  head,
  options,
  post,
  put,
  _delete as delete,
};
