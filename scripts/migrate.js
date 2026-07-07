const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set. Export it before running db:migrate.');
    process.exit(1);
  }

  const useSSL = process.env.DATABASE_SSL !== 'disable';
  const client = new Client({
    connectionString,
    ssl: useSSL ? { rejectUnauthorized: true } : false,
  });

  const schemaPath = path.join(__dirname, '..', 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');

  await client.connect();
  try {
    await client.query(schemaSql);
    console.log('Migration applied successfully from schema.sql');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
