"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchWithRetry = fetchWithRetry;
const node_fetch_1 = __importDefault(require("node-fetch"));
const DEFAULT_RETRY_COUNT = 3;
const DEFAULT_RETRY_DELAY_MS = 500;
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
async function fetchWithRetry(url, options, retries = DEFAULT_RETRY_COUNT) {
    let attempt = 0;
    let lastError;
    while (attempt <= retries) {
        try {
            const response = await (0, node_fetch_1.default)(url, options);
            if (!response.ok && attempt < retries) {
                throw new Error(`Request failed with status ${response.status}`);
            }
            return response;
        }
        catch (error) {
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
