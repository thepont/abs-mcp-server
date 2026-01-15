import { spawn } from 'child_process';

function sendMCPRequest(server, request) {
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

    server.stdout.on('data', onData);
    server.stdin.write(JSON.stringify(request) + '\n');
  });
}

const server = spawn('node', ['dist/index.js']);

const request = {
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/call',
  params: {
    name: 'get_supply_pipeline',
    arguments: { postcode: '2000' }
  }
};

sendMCPRequest(server, request).then((response) => {
  const result = JSON.parse(response.result.content[0].text);
  console.log('📊 Supply Pipeline Analysis for Postcode 2000:\n');
  console.log(JSON.stringify(result, null, 2));
  server.kill();
}).catch((err) => {
  console.error('Error:', err);
  server.kill();
  process.exit(1);
});
