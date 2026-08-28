import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.POSTGRES_URL!);

/**
 * Tagged-template Postgres client (Neon's serverless driver — works over
 * HTTP, so it's safe to call from Vercel serverless/edge functions).
 *
 * Usage: `const rows = await db<{ id: string }>\`select id from categories\`;`
 * — neon's own `sql` isn't generic per-call, so this thin wrapper adds that
 * back for typed row results.
 */
export async function db<T = Record<string, unknown>>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<T[]> {
  return (await sql(strings, ...values)) as unknown as T[];
}
