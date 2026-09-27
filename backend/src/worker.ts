import { initEmailWorker, stopEmailWorker } from './queues/emailWorker.js';
import { testDbConnection } from './db/prisma.js';

async function runWorker() {
  console.log('⚙️ Starting ReachInbox Dedicated Email Worker...');
  await testDbConnection();
  initEmailWorker();

  const shutdown = async () => {
    console.log('\n🛑 Stopping dedicated worker...');
    await stopEmailWorker();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

runWorker().catch((err) => {
  console.error('💥 Fatal error in standalone worker:', err);
  process.exit(1);
});
