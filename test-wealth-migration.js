import { spawn } from 'child_process';

const server = spawn('node', ['dist/index.js']);

function sendMCPRequest(request) {
  return new Promise((resolve, reject) => {
    let buffer = '';
    let messageCount = 0;

    const onData = (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      for (let i = 0; i < lines.length - 1; i++) {
        try {
          const msg = JSON.parse(lines[i]);
          messageCount++;
          if (messageCount === 2) resolve(msg);
        } catch (e) {}
      }
      buffer = lines[lines.length - 1];
    };

    const timeout = setTimeout(() => {
      reject(new Error(`Timeout after ${messageCount} messages`));
    }, 10000);

    server.stdout.on('data', onData);
    server.stdin.write(JSON.stringify(request) + '\n');
  });
}

const request = {
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/call',
  params: {
    name: 'get_wealth_migration',
    arguments: { region: 'Sydney' }
  }
};

console.log('Testing get_wealth_migration...');
sendMCPRequest(request)
  .then((response) => {
    console.log('✅ Success');
    const result = JSON.parse(response.result.content[0].text);
    console.log(JSON.stringify(result, null, 2));
    server.kill();
  })
  .catch((err) => {
    console.error('❌ Error:', err.message);
    server.kill();
    process.exit(1);
  });
