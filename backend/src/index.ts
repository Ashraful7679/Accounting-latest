import { createApp } from './app';
import { BackupService } from './modules/system/backup.service';

const fastify = createApp();

const start = async () => {
  try {
    const rawPort = process.env.PORT || '5002';
    const port = isNaN(Number(rawPort)) ? rawPort : parseInt(rawPort, 10);
    const host = '0.0.0.0';

    console.log(`Booting server... Attempting to listen on ${typeof port === 'number' ? `${host}:${port}` : `socket ${port}`}`);

    await fastify.listen({
      port: port as any,
      host: typeof port === 'number' ? host : undefined
    });

    console.log(`=========================================`);
    console.log(`Server ready at ${typeof port === 'number' ? `http://${host}:${port}` : `socket ${port}`}`);
    console.log(`=========================================`);

    setInterval(async () => {
      const now = new Date();
      if (now.getHours() === 2) {
        console.log('[Automated System Backup] Triggering 2AM disaster recovery snapshot...');
        try {
          const result = await BackupService.performBackup('SYSTEM_CRON');
          if (result.success) {
            console.log('[Automated System Backup] Success:', result.log?.fileName);
          } else {
            console.error('[Automated System Backup] Failed:', result.error);
          }
        } catch (err) {
          console.error('[Automated System Backup] Exception caught:', err);
        }
      }
    }, 3600000);

  } catch (err) {
    console.error('Fatal error during startup:', err);
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
