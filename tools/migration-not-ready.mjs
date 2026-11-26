console.error('MongoDB application migration is not yet integrated. This branch intentionally refuses to start the old PostgreSQL API or run database writes. Use npm run atlas:check to verify Atlas, or use main for the original PostgreSQL application. Import and review the complete MongoDB implementation before enabling the API.');
process.exitCode = 1;
