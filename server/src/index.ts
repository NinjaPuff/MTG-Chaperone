import 'dotenv/config';
import { loadConfig } from './di/config.js';
import { createDeps } from './di/deps.js';
import { createApp } from './app.js';

const config = loadConfig();
const deps = createDeps(config);
const app = createApp(deps);

if (config.nodeEnv !== 'test') {
  app.listen(config.serverPort, () => {
    deps.logger.info(`Server running on http://localhost:${config.serverPort}`);
  });
}

export default app;
