import { env } from './config/env.js';
import { buildApp } from './app.js';

async function main(): Promise<void> {
  const app = await buildApp({ env });

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'Shutting down');
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    app.log.info(
      {
        port: env.PORT,
        osrm: env.OSRM_URL,
        profile: env.DEFAULT_PROFILE,
        authDisabled: env.AUTH_DISABLED,
      },
      'MotoTracker Routing Service is up',
    );
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void main();
