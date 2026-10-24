const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

// Load environment variables (defaulting to .env)
const envFile = process.env.NODE_ENV === 'test' ? '.env.test' : '.env';
require('dotenv').config({ path: path.resolve(__dirname, '..', envFile) });

async function applySchema(targetDb) {
  const dbName = targetDb || process.env.DB_NAME || 'ticket_booking';
  const schemaPath = path.resolve(__dirname, '..', 'database', 'schema.sql');

  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Schema file not found at: ${schemaPath}`);
  }

  const sql = fs.readFileSync(schemaPath, 'utf8');

  console.log(`Applying schema.sql to database: ${dbName}...`);

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: dbName,
    multipleStatements: true
  });

  try {
    await connection.query(sql);
    console.log(`Successfully applied schema.sql to database: ${dbName}`);
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  const targetDb = process.argv[2];
  applySchema(targetDb)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Failed to apply schema:', err.message);
      process.exit(1);
    });
}

module.exports = applySchema;
