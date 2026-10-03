/**
 * Database package entry point.
 *
 * Re-exports the Prisma 7 generated client. The client is generated with:
 *
 *   npm run db:generate   (prisma generate)
 *
 * into `src/generated/prisma` (see prisma/schema.prisma generator output).
 * Until generation succeeds, imports of this package will not resolve —
 * this is expected and reported as a pending verification step.
 */
export * from "./generated/prisma/client.ts";
