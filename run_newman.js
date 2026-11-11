const newman = require('newman');
const path = require('path');
const http = require('http');
const app = require('./app');
const { initializeDB } = require('./database/database');

async function main() {
  console.log('--- Initializing SQLite Database for Newman ---');
  await initializeDB();

  const PORT = process.env.PORT || 3000;
  const server = http.createServer(app);

  await new Promise((resolve, reject) => {
    server.listen(PORT, (err) => {
      if (err) return reject(err);
      console.log(`Test server active on http://localhost:${PORT}/`);
      resolve();
    });
  });

  const collectionPath = path.join(__dirname, 'postman_collection.json');
  const reportPath = path.join(__dirname, 'newman-report.json');

  console.log('--- Starting Newman Automated Postman Collection Execution ---');

  newman.run(
    {
      collection: collectionPath,
      reporters: ['cli', 'json'],
      reporter: {
        json: {
          export: reportPath
        }
      },
      envVar: [
        {
          key: 'baseUrl',
          value: `http://localhost:${PORT}`
        }
      ]
    },
    (err, summary) => {
      server.close(() => {
        console.log('Test server shut down.');
      });

      if (err) {
        console.error('Newman encountered error:', err);
        process.exit(1);
      }

      const failures = summary.run.failures;
      if (failures && failures.length > 0) {
        console.error(`\n❌ Newman tests completed with ${failures.length} failures.`);
        process.exit(1);
      } else {
        console.log(`\n✅ All ${summary.run.stats.assertions.total} assertions passed across ${summary.run.stats.tests.total} test cases!`);
        console.log(`Automated Newman JSON report saved to: ${reportPath}`);
        process.exit(0);
      }
    }
  );
}

main().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
