// Tiny console logger. NEVER pass a private key or raw request body here.
function ts(): string {
  return new Date().toLocaleTimeString();
}

export const logger = {
  info: (...a: unknown[]) => console.log(`[${ts()}] [proxy]`, ...a),
  error: (...a: unknown[]) => console.error(`[${ts()}] [proxy]`, ...a),
};
