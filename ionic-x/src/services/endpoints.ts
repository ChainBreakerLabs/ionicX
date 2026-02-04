import { API_PATH_PREFIX, getBackendOrigin, getWsUrl } from "./backend";

export async function getApiBaseUrl() {
  const origin = await getBackendOrigin();
  return `${origin}${API_PATH_PREFIX}`;
}

export async function getApiBibleUrl() {
  return `${await getApiBaseUrl()}/v1/bible`;
}

export async function getApiBibleSearchUrl() {
  return `${await getApiBibleUrl()}/search`;
}

export async function getApiUploadUrl() {
  return `${await getApiBaseUrl()}/upload-video`;
}

export async function getApiUploadImageUrl() {
  return `${await getApiBaseUrl()}/upload-image`;
}

export async function getApiShutdownUrl() {
  return `${await getApiBaseUrl()}/shutdown`;
}

export async function getApiLyricsUrl() {
  return `${await getApiBaseUrl()}/v1/lyrics`;
}

export async function getApiCoversUrl() {
  return `${await getApiBaseUrl()}/v1/covers`;
}

export async function getWebSocketUrl() {
  return await getWsUrl();
}
