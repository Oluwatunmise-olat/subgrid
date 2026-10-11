import { validateRuntimeEnvs } from './conf/env';

export const bootstrap = async () => {
	validateRuntimeEnvs();
};
