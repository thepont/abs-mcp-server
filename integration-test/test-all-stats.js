#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const serverPath = join(__dirname, '..', 'dist', 'index.js');

function testAllStats() {
  console.log('Testing get_all_statistics tool...');
  
  const server = spawn('node', [serverPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let responseReceived = false;

  server.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(l => l.trim());
    lines.forEach(line => {
      try {
        const res = JSON.parse(line);
        if (res.id === 1) {
          responseReceived = true;
          console.log('\n--- get_all_statistics Response ---');
          console.log(JSON.stringify(res, null, 2));
          console.log('------------------------------------\n');
          
          if (res.result && !res.result.isError) {
            console.log('✅ Success: Received data from get_all_statistics');
            const content = JSON.parse(res.result.content[0].text);
            if (content.economic_health) {
              console.log(`✅ Economic Health: ${content.economic_health.status}`);
              console.log(`✅ Labour Data: Unemployment ${content.economic_health.labour_data.unemployment_rate}%`);
            } else {
              console.log('❌ Error: Missing economic_health data');
            }
          } else {
            console.log('❌ Error: Tool execution failed');
            console.log(res.error || res.result);
          }
        }
      } catch (e) {
        // Not JSON
      }
    });
  });

  server.stderr.on('data', (data) => {
    // console.error('Server Log:', data.toString());
  });

  // Call get_all_statistics
  const request = {
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
      name: 'get_all_statistics',
      arguments: { postcode: '2000' },
    },
    id: 1,
  };

  server.stdin.write(JSON.stringify(request) + '\n');

  setTimeout(() => {
    if (!responseReceived) {
      console.log('❌ Error: Timeout waiting for response');
      server.kill();
      process.exit(1);
    }
    server.kill();
    process.exit(0);
  }, 10000); // Increased timeout to 10s for API calls
}

testAllStats();
