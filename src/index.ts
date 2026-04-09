import { app } from './app';
import { env } from './config/env';
import { logger } from './shared/logger';

const isVercelRuntime = process.env.VERCEL === '1' || Boolean(process.env.VERCEL_ENV);

if (!isVercelRuntime) {
  app.listen(env.PORT, () => {
    logger.info(
      `Server running on port ${env.PORT} in ${env.APP_ENV} mode using ${env.CLIENT_PLATFORM_STORAGE} client storage`
    );
  });
}

export default app;
