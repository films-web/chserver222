require('dotenv').config();
const { Client } = require('pg');

async function formatDatabase() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is missing in your .env file!');
    process.exit(1);
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });

  try {
    console.log('⏳ Connecting to the database...');
    await client.connect();

    // 1. Fetch all table names dynamically from the public schema
    const { rows } = await client.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
    `);

    if (rows.length === 0) {
      console.log('ℹ️  No tables found to format.');
      return;
    }

    // 2. Wrap table names in quotes to handle capitalization (e.g., "Fairshot", "Payload")
    const tables = rows.map(r => `"${r.tablename}"`).join(', ');

    console.log(`🧹 Formatting tables: ${tables}`);
    
    // 3. Truncate them all, cascade to ignore foreign key blocks, and reset IDs
    await client.query(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE;`);

    console.log('✅ Database Format Complete! All data erased, IDs reset to 1.');
  } catch (err) {
    console.error('❌ Error formatting database:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

formatDatabase();