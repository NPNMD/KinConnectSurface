"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.escapeHtml = void 0;
/**
 * Escapes HTML special characters to prevent XSS attacks.
 * @param unsafe - The string to escape
 * @returns The escaped string
 */
const escapeHtml = (unsafe) => {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};
exports.escapeHtml = escapeHtml;
