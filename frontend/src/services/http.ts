import axios from 'axios';

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
const baseUrl = rawBaseUrl ? rawBaseUrl.replace(/\/+$/, '') : '';

if (baseUrl) {
  axios.defaults.baseURL = baseUrl;
}
