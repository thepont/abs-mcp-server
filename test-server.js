#!/usr/bin/env node

/*
 * abs-mcp-server integration test
 * Copyright (C) 2026 Paul Esson
 * GPL-3.0
 *
 * This script tests the MCP server's tool discovery and tool calls
 */

import { spawn } from 'child_process';

const serverPath = '/Users/paulesson/projects/abs-mcp-server/dist/index.js';

function testServer() {
  const server = spawn('node', [serverPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let responses = [];

  server.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(l => l.trim());
    lines.forEach(line => {
      try {
        const res = JSON.parse(line);
        responses.push(res);
        console.log('Response:', JSON.stringify(res, null, 2));
      } catch (e) {
        // Ignore parse errors
      }
    });
  });

  server.stderr.on('data', (data) => {
    console.error('Server error:', data.toString());
  });

  // Test 1: List tools
  console.log('\n✓ Test 1: Listing tools...');
  server.stdin.write(
    JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/list',
      params: {},
      id: 1,
    }) + '\n'
  );

  setTimeout(() => {
    // Test 2: Call get_suburb_stats
    console.log('\n✓ Test 2: Calling get_suburb_stats...');
    server.stdin.write(
      JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'get_suburb_stats',
          arguments: { postcode: '2000' },
        },
        id: 2,
      }) + '\n'
    );
  }, 1000);

  setTimeout(() => {
    // Test 3: Call get_mortgage_stress
    console.log('\n✓ Test 3: Calling get_mortgage_stress...');
    server.stdin.write(
      JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'get_mortgage_stress',
          arguments: { region: '2000' },
        },
        id: 3,
      }) + '\n'
    );
  }, 2000);

  setTimeout(() => {
    console.log('\n✓ All tests completed!');
    server.kill();
    process.exit(responses.length > 0 ? 0 : 1);
  }, 3000);
}

testServer();
