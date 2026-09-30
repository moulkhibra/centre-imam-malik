/**
 * Client-bundle guard.
 *
 * Next.js ships a `server-only` package, but it resolves to a module that
 * throws in any non-React-Server environment - which breaks Node scripts
 * (setup, PDF verification) and the Vitest integration suite that legitimately
 * need to import server modules.
 *
 * This guard gives the same protection for the real risk (accidentally pulling
 * a server module into a Client Component) while remaining importable from
 * plain Node, because a server module can only ever execute in a browser if the
 * bundler shipped it to the client, and in a browser `window` always exists.
 */
if (typeof window !== 'undefined') {
  throw new Error(
    'This module can only be used on the server. Do not import it from a Client Component.',
  );
}

export {};
