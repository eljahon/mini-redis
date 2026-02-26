const net = require('net');

class MiniRedis {
  constructor() {
    this.store = new Map();
  }

  handleCommand(cmd, args, socket) {
    switch (cmd.toUpperCase()) {
      case 'PING':
        socket.write('+PONG\r\n');
        break;

      case 'ECHO':
        const msg = args[0] || '';
        socket.write(`$${Buffer.byteLength(msg)}\r\n${msg}\r\n`);
        break;

      case 'SET':
        if (args.length < 2) {
          socket.write('-ERR wrong number of arguments for SET\r\n');
          return;
        }
        this.store.set(args[0], args[1]);
        socket.write('+OK\r\n');
        break;

      case 'GET':
        if (args.length < 1) {
          socket.write('-ERR wrong number of arguments for GET\r\n');
          return;
        }
        const value = this.store.get(args[0]);
        if (value === undefined) {
          socket.write('$-1\r\n');
        } else {
          socket.write(`$${Buffer.byteLength(value)}\r\n${value}\r\n`);
        }
        break;

      case 'DEL':
        let deleted = 0;
        for (let key of args) {
          if (this.store.delete(key)) deleted++;
        }
        socket.write(`:${deleted}\r\n`);
        break;

      case 'EXISTS':
        let count = 0;
        for (let key of args) {
          if (this.store.has(key)) count++;
        }
        socket.write(`:${count}\r\n`);
        break;

      case 'KEYS':
        const pattern = args[0] || '*';
        if (pattern === '*') {
          const keys = Array.from(this.store.keys());
          socket.write(`*${keys.length}\r\n`);
          for (let key of keys) {
            socket.write(`$${Buffer.byteLength(key)}\r\n${key}\r\n`);
          }
        } else {
          socket.write('*0\r\n');
        }
        break;

      default:
        socket.write(`-ERR unknown command '${cmd}'\r\n`);
    }
  }
}

function parseRESP(data) {
  const str = data.toString('utf8').trim();
  if (!str) return null;

  const lines = str.split('\r\n');
  let i = 0;

  function parse() {
    if (i >= lines.length) return null;
    const line = lines[i++];
    if (!line) return null;

    const type = line[0];
    const content = line.slice(1);

    if (type === '*') {
      const count = parseInt(content);
      if (isNaN(count) || count < 0) return null;
      const arr = [];
      for (let j = 0; j < count; j++) {
        const item = parse();
        arr.push(item);
      }
      return arr;
    } else if (type === '$') {
      const len = parseInt(content);
      if (len === -1) return null;
      return lines[i++] || '';
    }
    return content;
  }

  return parse();
}

const redisServer = new MiniRedis();

const server = net.createServer((socket) => {
  console.log(` Klient ulandi: ${socket.remoteAddress}:${socket.remotePort}`);

  socket.on('data', (data) => {
    try {
      const parsed = parseRESP(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const command = parsed[0];
        const args = parsed.slice(1);
        redisServer.handleCommand(command, args, socket);
      }
    } catch (err) {
      console.error('Xatolik:', err.message);
      socket.write('-ERR protocol error\r\n');
    }
  });

  socket.on('end', () => console.log('Klient uzildi'));
  socket.on('error', (err) => console.error('Socket xatosi:', err.message));
});

const PORT = 6370;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Mini Redis (Node.js) ${PORT} portda ishga tushdi!`);
  console.log(`Test qilish uchun: redis-cli -p 6370`);
});