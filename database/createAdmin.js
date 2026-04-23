require('dotenv').config();
const { Pool } = require('pg');
const { createAdminUser } = require('../src/services/userService');

async function setup() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const username = 'admin';
    const password = 'MySecurePassword123!';
    
    await createAdminUser(pool, username, password);
    console.log(`✅ Admin user '${username}' created successfully.`);
  } catch (err) {
    console.error('❌ Failed to create admin:', err.message);
  } finally {
    await pool.end();
  }
}

setup();