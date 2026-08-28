// One-off local script: applies schema.sql then seed.sql to POSTGRES_URL.
// Run with `npm run db:migrate`. Not deployed — dev tooling only.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

async function main() {
  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error("POSTGRES_URL is not set (check .env)");
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    const schema = readFileSync(join(import.meta.dirname, "schema.sql"), "utf8");
    console.log("Applying schema.sql...");
    await client.query(schema);

    const seed = readFileSync(join(import.meta.dirname, "seed.sql"), "utf8");
    console.log("Applying seed.sql...");
    await client.query(seed);

    console.log("Done.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
