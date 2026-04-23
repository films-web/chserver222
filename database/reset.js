require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function resetDatabase() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is missing in your .env file!');
    process.exit(1);
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });

  try {
    console.log('⏳ Connecting to the database...');
    await client.connect();

    console.log('🔥 Dropping the public schema (destroying all tables)...');
    await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');

    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log('📜 Injecting fresh schema.sql...');
    await client.query(schemaSql);
    
    console.log('✅ Database Reset Complete! It is now a blank slate.');
  } catch (err) {
    console.error('❌ Error resetting database:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

resetDatabase();