# Axios Sisyphus

Simply put, this is a lightweight wrapper over [`axios.request`](https://google.com) that enables a retrial mechanism for failed requests.

External services are not always reliable. Random failures can easily break the flow of your application. While this is alright sometimes, other times it might make more sense to keep on retrying the requests with the hope of succeeding.

Much like Albert Camus, we sometimes need to subject our external HTTP requests to _endless\*_ cycles of futile labor. We hope, however, that our Sisyphus can break this cycle and improve the resilience of external service communication.

![we must imagine Sisyphus happy](https://img.enkipro.com/d4c2ac02e4802d7203a3b3498548edd5.jpeg)
_image taken from [existentialcomics](https://existentialcomics.com/comic/29)_

## Installation

This module should work both for Node and browser environments.

```sh
npm install --save axios-sisyphus
```

## Usage

Using `axios-sisyphus` is as easy as doing:

```ts
import { get } from '@enkidevs/axios-sisyphus';

const response = await get({ retries: 5 }, { url: 'https://github.com' });
```

For commonJS you can import the library like this:

```js
const request = require('@enkidevs/axios-sisyphus').default;
```

## API

This module exports by default a `request` function.

This will need two arguments: a `config` and an `axiosConfig`.

I . `config` contains the input configuration for the retrial mechanism:

```ts
type Config<R = any> = {
  retries?: number;
  responseFailedFilter?: (response: AxiosResponse<R>) => Promise<boolean>;
  failedIterationCallback?: (index: number) => Promise<void>;
};

const config = {
  retries: 3,
  responseFailedFilter: (response) => false,
  failedIterationCallback: (index) => {},
};
```

- `retries`, optional - number of maximum retrials attempted in case of subsequent failing requests. defaults to `1` retry
- `responseFailedFilter`, optional - async function invoked on all successful responses that can be used to interpret them as failed; this can be useful in case of APIs that return `200` unsuccessful responses which axios treat as successful ones because of the status code. must return a boolean. `true` means that the response is failed
- `failedIterationCallback`, optional - async function invoked after each **failed** request; this can be useful to add delays or custom scheduling in-between retries

II. `axiosConfig` specifies the HTTP call configuration, mirroring [axios behavior](https://github.com/axios/axios/blob/master/index.d.ts#L44):

```ts
const axiosConfig = {
  url: 'https://slack.com/api/chat.postMessage',
  method: 'POST',
  data,
};
```

With these inputs you should be able to use the `request` function:

```ts
import request from '@enkidevs/axios-sisyphus';

request({ retries: 3 }, { url: 'https://some-url.io', method: 'GET' })
  .then((response) => {
    // do something with successful response
    // response data is in response.data
  })
  .catch((error) => {
    // do something with all unsuccessful responses
    // errors are in error.errors
  });
```

In the case of a successful response, `request` will return an [Axios Response](https://github.com/axios/axios#response-schema):

```ts
const response: AxiosResponse = {
  data: {},
  status: 200,
  statusText: 'OK',
  headers: {},
  config: {},
  request: {},
};
```

In the case of no successful response within all retries, an `Error` object is thrown. Within it, the `errors` key will hold an array with all [axios response errors](https://github.com/axios/axios/blob/master/index.d.ts#L85). Moreover, if `responseFailedFilter` was used, this can also include valid axios responses.

To mirror axios' API method aliases are also exposed by `axios-sisyphus`:

```ts
import * as sisyphus from '@enkidevs/axios-sisyphus';
// import { get } from '@enkidevs/axios-sisyphus'; also works

sisyphus.get(config, axiosConfig);
sisyphus.head(config, axiosConfig);
sisyphus.options(config, axiosConfig);
sisyphus.delete(config, axiosConfig);
sisyphus.post(config, axiosConfig);
sisyphus.put(config, axiosConfig);
sisyphus.patch(config, axiosConfig);
```

**NOTE**: When using these aliases there's no need to pass `method` as an property of `axiosConfig`.

## Recipes

Here are some common recipes that might be useful:

I. Retry with delay in-between failed requests:

```ts
const retries = 3;
const delay = 2000; // 2 s

const wait = async (index) => {
  // don't wait after last retry
  if (index < retries) {
    await new Promise((r) => setTimeout(r, delay));
  }
};

await request(
  { retries, failedIterationCallback: wait },
  { method: 'GET', host: 'https://github.com/' },
);
```

II. Interpret a successful request as a failed one

One practical usage for this is Slack's api which returns a `200` even if an error occurred. Instead, the status is specified through the `ok` boolean. You can read more about this [here](https://api.slack.com/web#responses).

```ts
const responseFailedFilter = async (response) => !response.data.ok;

await sisyphus.post(
  { retries: 1, responseFailedFilter },
  { host: 'https://slack.com/api/chat.postMessage', data, headers },
);

// this will now throw if ok === false
```

## Typescript

This project has been built with TypeScript ❤️. Hence, support for types comes out of the box.

All methods exposed by `axios-sisyphus` accept a **generic** which matches the shape of the response payload.

```ts
type Payload = {
  ok: boolean;
};

try {
  const response = await request<Payload>({ retries: 3 }, axiosConfig);
  // type of response is AxiosResponse<Payload>
} catch (error) {
  // type of error isError & { errors: Array<AxiosError | AxiosResponse<Payload>>; }
}
```

This generic defaults to `any`.

We also export the types used in this library:

- `Config` -> axios-sisyphus configuration
- `ErrorList` -> extended `Error` with `{ errors: Array<AxiosError | AxiosResponse<R>>; }`
- `Response<R = any>` -> `Promise<AxiosResponse<R>>`
