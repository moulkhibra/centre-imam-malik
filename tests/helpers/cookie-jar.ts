/**
 * In-memory cookie jar used to exercise the real session code in Vitest.
 *
 * `next/headers` cannot be called outside a request, so tests mock it with this
 * object. The production functions (createSession, destroySession,
 * getCurrentUser) are used unmodified, which means the tests cover the real
 * hashing, expiry and revocation logic rather than a re-implementation.
 */

export type CookieRecord = { value: string };

const jar = new Map<string, string>();

export const cookieJar = {
  get(name: string): CookieRecord | undefined {
    const value = jar.get(name);
    return value === undefined ? undefined : { value };
  },
  set(name: string, value: string): void {
    jar.set(name, value);
  },
  delete(name: string): void {
    jar.delete(name);
  },
  clear(): void {
    jar.clear();
  },
  entries(): [string, string][] {
    return [...jar.entries()];
  },
};

/** Builds a `next/headers` mock. Use inside `vi.mock` factories. */
export function createNextHeadersMock() {
  return {
    cookies: async () => cookieJar,
    headers: async () => new Headers({ 'user-agent': 'vitest' }),
  };
}
