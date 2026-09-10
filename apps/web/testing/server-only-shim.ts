// Vitest runs outside Next.js's webpack build, which is what normally
// no-ops the `server-only` package's client-import guard. Aliased in
// vitest.config.ts so any server-only module can be unit tested here
// without pulling in the whole Next.js build pipeline.
export {};
