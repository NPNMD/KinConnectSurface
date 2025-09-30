import fetch, { RequestInit, Response } from 'node-fetch';

const DEFAULT_RETRY_COUNT = 3;
const DEFAULT_RETRY_DELAY_MS = 500;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function fetchWithRetry(url: string, options?: RequestInit, retries: number = DEFAULT_RETRY_COUNT): Promise<Response> {
  let attempt = 0;
  let lastError: unknown;

  while (attempt <= retries) {
    try {
      const response = await fetch(url, options);
      if (!response.ok && attempt < retries) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      return response;
    } catch (error) {
      lastError = error;
      attempt++;
      if (attempt > retries) {
        break;
      }
      await sleep(DEFAULT_RETRY_DELAY_MS * attempt);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Network request failed');
}

