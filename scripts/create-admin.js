// One-off ops script: creates an ADMIN user directly in Postgres for initial
// login on a fresh database. Run with: node scripts/create-admin.js [flags]
//
// Usage:
//   node scripts/create-admin.js --email admin@company.com --username admin
//   (password is prompted for, hidden; or set ADMIN_PASSWORD / pass --password)
//
// Env vars (used if the matching flag is omitted): ADMIN_EMAIL, ADMIN_USERNAME, ADMIN_PASSWORD
const readline = require('readline');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

// Must match lib/auth.ts's hashPassword() exactly (same algorithm/cost),
// otherwise this admin's hash won't verify against the real login route.
const SALT_ROUNDS = 12;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

function promptVisible(query) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Hides typed characters by redrawing a blank prompt line on every keystroke.
// Requires an interactive TTY; falls back to --password/ADMIN_PASSWORD otherwise.
function promptHidden(query) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      reject(new Error('Not an interactive terminal. Pass --password or set ADMIN_PASSWORD instead.'));
      return;
    }
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const onData = (chunk) => {
      const str = chunk.toString();
      if (str === '\n' || str === '\r' || str === '') return;
      readline.moveCursor(process.stdout, 0, -1);
      readline.clearLine(process.stdout, 0);
      process.stdout.write(query);
    };
    process.stdin.on('data', onData);
    rl.question(query, (answer) => {
      process.stdin.removeListener('data', onData);
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }

  const args = parseArgs(process.argv.slice(2));

  let email = args.email || process.env.ADMIN_EMAIL;
  let username = args.username || process.env.ADMIN_USERNAME;
  let password = args.password || process.env.ADMIN_PASSWORD;

  if (!email) email = await promptVisible('Admin email: ');
  if (!username) username = await promptVisible('Admin username: ');
  if (!password) password = await promptHidden('Admin password: ');

  email = (email || '').trim();
  username = (username || '').trim();

  if (!email || !email.includes('@')) {
    console.error('A valid email is required.');
    process.exit(1);
  }
  if (!username) {
    console.error('A username is required.');
    process.exit(1);
  }
  if (!password || password.length < 8) {
    console.error('A password of at least 8 characters is required.');
    process.exit(1);
  }

  const useSSL = process.env.DATABASE_SSL !== 'disable';
  const pool = new Pool({
    connectionString,
    ssl: useSSL ? { rejectUnauthorized: true } : false,
  });

  try {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    password = undefined; // drop the plaintext reference as soon as it's hashed

    const id = `user-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    const result = await pool.query(
      `INSERT INTO users (id, username, email, password, role, status, requires_password_change, profile_pic, session_version)
       VALUES ($1, $2, $3, $4, 'ADMIN', 'ACTIVE', false, NULL, 1)
       RETURNING id, username, email`,
      [id, username, email, passwordHash]
    );

    const created = result.rows[0];
    console.log(`Admin user created: username="${created.username}" email="${created.email}"`);
  } catch (err) {
    if (err.code === '23505') {
      console.error('A user with that username or email already exists.');
    } else {
      console.error('Failed to create admin user:', err.message);
    }
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
