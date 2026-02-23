// input:  [`VITE_API_BASE_URL` build env and axios default configuration surface]
// output: [startup side effect that sets axios `baseURL` when configured]
// pos:    [One-time HTTP client bootstrap imported by `src/main.tsx`]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import axios from 'axios';

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
const baseUrl = rawBaseUrl ? rawBaseUrl.replace(/\/+$/, '') : '';

if (baseUrl) {
  axios.defaults.baseURL = baseUrl;
}
