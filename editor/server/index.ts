import { createServer } from 'node:http';
import { createRequestListener } from './app.js';

const port = Number(process.env.PORT) || 8080;
const server = createServer(createRequestListener());

server.listen(port, () => {
  console.log(`NAMCHE Brand Studio server listening on port ${port}`);
});

function shutdown(signal: NodeJS.Signals): void {
  console.log(`Received ${signal}, shutting down`);
  server.close(() => process.exit(0));
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
