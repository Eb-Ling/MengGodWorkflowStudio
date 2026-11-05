const net = require('node:net');

function reservePort(preferredPort = 4174) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    // Register once: a failed listen must not leave a second listening callback behind.
    server.once('listening', () => {
      const { port } = server.address();
      server.close(error => error ? reject(error) : resolve(port));
    });
    server.once('error', error => {
      if (error.code === 'EADDRINUSE' && preferredPort) {
        server.once('error', reject);
        server.listen(0, '127.0.0.1');
      } else reject(error);
    });
    server.listen(preferredPort, '127.0.0.1');
  });
}

module.exports = { reservePort };
