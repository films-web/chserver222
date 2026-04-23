require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function setupDatabase() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is missing in your .env file!');
    process.exit(1);
  }

  const dbUrl = new URL(process.env.DATABASE_URL);
  const targetDb = dbUrl.pathname.slice(1);

  const defaultClient = new Client({
    user: dbUrl.username,
    password: dbUrl.password,
    host: dbUrl.hostname,
    port: dbUrl.port,
    database: 'postgres',
  });

  try {
    console.log('⏳ Connecting to PostgreSQL...');
    await defaultClient.connect();

    const res = await defaultClient.query(
      `SELECT datname FROM pg_catalog.pg_database WHERE datname = $1`,
      [targetDb]
    );

    if (res.rowCount === 0) {
      console.log(`🔨 Creating database "${targetDb}"...`);
      await defaultClient.query(`CREATE DATABASE "${targetDb}"`);
      console.log('✅ Database created successfully.');
    } else {
      console.log(`ℹ️  Database "${targetDb}" already exists. Skipping creation.`);
    }
  } catch (err) {
    console.error('❌ Error creating database:', err.message);
    process.exit(1);
  } finally {
    await defaultClient.end();
  }

  const targetClient = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log(`⏳ Connecting to "${targetDb}"...`);
    await targetClient.connect();

    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log('📜 Injecting schema.sql...');
    await targetClient.query(schemaSql);
    
    console.log('✅ Setup Complete! Your database is fully built and ready.');
  } catch (err) {
    console.error('❌ Error injecting schema:', err.message);
    process.exit(1);
  } finally {
    await targetClient.end();
  }
}

setupDatabase();