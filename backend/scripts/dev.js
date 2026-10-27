process.env.NODE_ENV = 'development';
const { startServer } = await import('../src/server.js');
startServer({ runBackgroundWorkers: false });
