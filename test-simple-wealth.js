import { spawn } from 'child_process';

const server = spawn('node', ['dist/index.js'], { stdio: ['pipe', 'pipe', 'inherit'] });

const request = {
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/call',
  params: {
    name: 'get_wealth_migration',
    arguments: { region: 'Sydney' }
  }
};

console.log('Sending request...');
server.stdin.write(JSON.stringify(request) + '\n');

let buffer = '';
server.stdout.on('data', (chunk) => {
  buffer += chunk.toString();
  console.log('Got data:', chunk.toString().substring(0, 100));
  
  const lines = buffer.split('\n');
  if (lines.length > 1) {
    for (let i = 0; i < lines.length - 1; i++) {
      try {
        const msg = JSON.parse(lines[i]);
        console.log('Parsed message:', JSON.stringify(msg).substring(0, 200));
      } catch (e) {
        // Not a complete message yet
      }
    }
  }
});

setTimeout(() => {
  console.log('Timeout - killing server');
  server.kill();
  process.exit(1);
}, 10000);
