// Temporary bridge to the already migrated local backend; no PostgreSQL fallback.
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { spawn } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = file => JSON.parse(readFileSync(file, 'utf8'));
const mode = process.argv[2] || 'dev';
const choices = {
  dev: ['dev:api', 'dev'], check: ['db:check'], init: ['db:init'],
  admin: ['db:admin', 'db:create-admin', 'admin:create', 'create:admin', 'db:seed:admin', 'db:bootstrap-admin'],
};
try {
  if (mode === 'no-seed' || mode === 'no-rollback') throw new Error('Disabled on the Atlas bridge branch. Do not seed demo data or run PostgreSQL rollback scripts.');
  const envPath = resolve(root, 'server', '.env');
  const config = existsSync(envPath) ? parseEnv(readFileSync(envPath, 'utf8')) : {};
  const sourceSetting = process.env.KD_MONGO_BACKEND_DIR || config.KD_MONGO_BACKEND_DIR;
  if (!sourceSetting) throw new Error('Set KD_MONGO_BACKEND_DIR in server/.env to the existing migrated project folder.');
  if (!existsSync(sourceSetting)) throw new Error('KD_MONGO_BACKEND_DIR does not exist. Check the path.');
  const source = realpathSync(sourceSetting);
  if (source === realpathSync(root)) throw new Error('Choose the separate MongoDB implementation folder, not the Recovery repository.');
  const sourceServer = resolve(source, 'server');
  const rootPackage = readJson(resolve(source, 'package.json'));
  const serverPackage = readJson(resolve(sourceServer, 'package.json'));
  const deps = {...rootPackage.dependencies, ...serverPackage.dependencies};
  if (!deps.mongodb && !deps.mongoose) throw new Error('Selected backend does not declare mongodb or mongoose. No PostgreSQL fallback is allowed.');
  const dbModule = resolve(sourceServer, 'src', 'db.js');
  if (existsSync(dbModule)) {
    const dbCode = readFileSync(dbModule, 'utf8');
    if (/\bpg\.Pool\b|from\s+['"]pg['"]/.test(dbCode) && !/mongodb|mongoose/i.test(dbCode)) {
      throw new Error('Selected backend db.js still appears to be PostgreSQL-only.');
    }
  }
  if (mode === 'source') {
    console.log(JSON.stringify({source, driver: deps.mongodb ? 'mongodb' : 'mongoose', rootScripts:Object.keys(rootPackage.scripts||{}), serverScripts:Object.keys(serverPackage.scripts||{})}, null, 2));
  } else {
    if (!Object.hasOwn(choices, mode)) throw new Error('Unknown Atlas launcher mode.');
    const uri = process.env.MONGODB_URI || config.MONGODB_URI;
    let target;
    try { target = new URL(uri); } catch { throw new Error('Set a valid MONGODB_URI in server/.env.'); }
    if (target.protocol !== 'mongodb+srv:' || !target.hostname.endsWith('.mongodb.net') || !target.username || !target.password || /[<>]/.test(uri) || target.pathname !== '/kd_design') {
      throw new Error('MONGODB_URI must use an authenticated Atlas SRV URI for database kd_design, without placeholders.');
    }
    if ([...target.searchParams].some(([k,v]) => (/^(tls|ssl)$/i.test(k) && /^false$/i.test(v)) || (/^(tlsInsecure|tlsAllowInvalidCertificates|tlsAllowInvalidHostnames|sslAllowInvalidCertificates|sslAllowInvalidHostnames)$/i.test(k) && /^true$/i.test(v)))) {
      throw new Error('Insecure TLS options are not allowed.');
    }
    const secret = process.env.JWT_SECRET || config.JWT_SECRET || '';
    if (mode === 'dev' && (secret.trim().length < 32 || /replace-this|YOUR_PRIVATE_SECRET/i.test(secret))) throw new Error('Set a private JWT_SECRET of at least 32 characters.');
    const candidates = choices[mode];
    // dev:api belongs to the source root; dev is only a fallback in its API workspace.
    const match = mode === 'dev'
      ? (rootPackage.scripts?.['dev:api'] ? [source, 'dev:api'] : serverPackage.scripts?.dev ? [sourceServer, 'dev'] : null)
      : candidates.flatMap(name => [[source, name, rootPackage], [sourceServer, name, serverPackage]]).find(([,name,pkg])=>pkg.scripts?.[name]);
    if (!match) throw new Error('Source has no matching '+mode+' script. Run npm run atlas:source to list available scripts. No seed or reset was attempted.');
    if (mode === 'admin') {
      const password = process.env.ADMIN_PASSWORD || config.ADMIN_PASSWORD || '';
      const email = process.env.ADMIN_EMAIL || config.ADMIN_EMAIL || '';
      if (!email.includes('@') || password.length < 12 || password === 'ChangeMe-Strong-2026!') throw new Error('Set a real ADMIN_EMAIL and a new ADMIN_PASSWORD of at least 12 characters.');
    }
    const npmCli = process.env.npm_execpath;
    if (!npmCli || !existsSync(npmCli)) throw new Error('Run this launcher via npm run.');
    const env = {...process.env, ...config, MONGODB_URI:uri, JWT_SECRET:secret, PORT:'4000', MONGODB_DB:'kd_design', MONGODB_DATABASE:'kd_design', MONGODB_DB_NAME:'kd_design', MONGO_DB_NAME:'kd_design', DATABASE_URL:'postgresql://disabled:disabled@127.0.0.1:1/disabled'};
    console.log('Starting MongoDB source script:', match[1], '| Atlas database: kd_design | API port: 4000');
    const child = spawn(process.execPath, [npmCli, 'run', match[1]], {cwd:match[0], env, stdio:'inherit', shell:false});
    child.on('error', () => { console.error('Could not start migrated backend script.'); process.exitCode=1; });
    child.on('exit', (code, signal) => { process.exitCode = code ?? (signal==='SIGINT'?130:1); });
  }
} catch (error) {
  // Configuration errors only; never print URI, credentials or nested stack traces.
  console.error(error instanceof SyntaxError ? 'Invalid source package.json or environment configuration.' : error.code ? 'Source configuration could not be read ('+error.code+').' : error.message);
  process.exitCode=1;
}
