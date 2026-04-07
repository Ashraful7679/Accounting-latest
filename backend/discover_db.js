const { Client } = require('pg');

async function discover() {
  const commonUrls = [
    'postgresql://postgres:postgres@localhost:5432/postgres',
    'postgresql://postgres@localhost:5432/postgres',
    'postgresql://localhost:5432/postgres'
  ];

  for (const url of commonUrls) {
    const client = new Client({ connectionString: url });
    try {
      await client.connect();
      console.log(`Connected to: ${url}`);
      const res = await client.query('SELECT datname FROM pg_database WHERE datistemplate = false;');
      console.log('Databases found:', res.rows.map(r => r.datname).join(', '));
      await client.end();
      return;
    } catch (e) {
      console.error(`Failed to connect to ${url}: ${e.message}`);
    }
  }
}

discover();
