// Defense in depth for results returned by shared internal services. Sensitive
// SRI/authentication models are never public resources; this additionally keeps
// internal storage locations and future secret fields out of API responses.
const internalField = /password|secret|credential|token|keyHash|StorageKey|privateKey|certificate/i;
export function publicPayload(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value, (key, entry) => internalField.test(key) ? undefined : entry));
}
