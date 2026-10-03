import { createApiClient, type ApiClient } from "@erapor/api-client";

/**
 * Instance API client untuk browser. Semua request lewat proxy same-origin
 * /api/v1 sehingga cookie sesi HttpOnly otomatis terkirim.
 */
let client: ApiClient | null = null;

export function api(): ApiClient {
  if (!client) {
    client = createApiClient({ baseUrl: "/api/v1" });
  }
  return client;
}
