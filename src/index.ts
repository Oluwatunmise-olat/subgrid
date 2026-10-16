import 'reflect-metadata';
import Application from './app';
import { logger } from './common/utils/logger/pino';
import { app } from './conf/env';

export const application = new Application();

process
	.on('uncaughtException', async (error) => {
		logger.error({ err: error }, 'UNCAUGHT_EXCEPTION');
		await application.close();
		process.exit(1);
	})
	.on('SIGINT', async () => {
		await application.close();
		process.exit(1);
	});

application
	.listen(app.port)
	.then(() => logger.info(`Server is listening on port ${app.port}`))
	.catch((error) => {
		logger.error({ err: error }, 'An error occurred while trying to start server');
		process.exit(1);
	});
