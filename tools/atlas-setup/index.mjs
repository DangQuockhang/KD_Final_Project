// Independent Atlas diagnostic/bootstrap. It deliberately does not change the PostgreSQL API.
const databaseName = 'kd_design';
const mode = process.argv[2] ?? '--check';
const uri = process.env.MONGODB_URI?.trim();
let client;
let phase = 'configuration';

try {
  if (!['--check', '--init'].includes(mode)) throw Object.assign(new Error(), {code:'INVALID_MODE'});
  if (!uri || !uri.startsWith('mongodb+srv://') || /[<>]/.test(uri)) {
    throw Object.assign(new Error(), {code:'MONGODB_URI_MISSING_OR_PLACEHOLDER'});
  }
  // Refuse non-Atlas hosts and insecure TLS options, so this tool cannot accidentally
  // initialize the temporary local MongoDB or a connection with disabled TLS validation.
  let target;
  try { target = new URL(uri); } catch {
    throw Object.assign(new Error(), {code:'INVALID_MONGODB_URI'});
  }
  if (!target.hostname.endsWith('.mongodb.net') ||
      !target.username || !target.password ||
      [...target.searchParams].some(([key,value]) =>
        (/^(tls|ssl)$/i.test(key) && /^false$/i.test(value)) ||
        (/^(tlsInsecure|tlsAllowInvalidCertificates|tlsAllowInvalidHostnames|sslAllowInvalidCertificates|sslAllowInvalidHostnames)$/i.test(key) && /^true$/i.test(value)))) {
    throw Object.assign(new Error(), {code:'INVALID_OR_INSECURE_ATLAS_URI'});
  }
  if (target.pathname !== '' && target.pathname !== '/' && target.pathname !== '/' + databaseName) {
    throw Object.assign(new Error(), {code:'ATLAS_DATABASE_MISMATCH'});
  }
  phase = 'driver';
  const {MongoClient} = await import('mongodb');
  client = new MongoClient(uri, {
    serverSelectionTimeoutMS:10000,
    connectTimeoutMS:10000,
    socketTimeoutMS:15000,
    appName:'kd-atlas-setup'
  });
  phase = 'connect';
  await client.connect();
  const db = client.db(databaseName);
  await db.command({ping:1});

  if (mode === '--init') {
    phase = 'initialize';
    // Explicit opt-in, idempotent: creates the database/marker if absent,
    // never overwrites existing documents or seeds business data.
    const result = await db.collection('_kd_setup').updateOne(
      {_id:'atlas-bootstrap-v1'},
      {$setOnInsert:{purpose:'Atlas connectivity bootstrap only; not application schema',createdAt:new Date()}},
      {upsert:true,writeConcern:{w:'majority'}}
    );
    console.log(JSON.stringify({database:databaseName,markerCreated:result.upsertedCount===1,markerPresent:true}));
  }
  phase = 'list-collections';
  const collections = await db.listCollections({}, {nameOnly:true}).toArray();
  console.log(JSON.stringify({ok:true,database:databaseName,mode,collections:collections.map(c=>c.name).sort(),applicationMigrated:false},null,2));
} catch (error) {
  // No URI, error message, credentials, or database records in terminal logs.
  console.error(JSON.stringify({ok:false,phase,code:error.code ?? error.name ?? 'ATLAS_SETUP_FAILED'}));
  process.exitCode = 1;
} finally {
  if (client) await client.close().catch(()=>{process.exitCode=1;});
}
