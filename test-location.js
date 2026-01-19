#!/usr/bin/env node

/*
 * abs-mcp-server lat/long lookup test
 * Copyright (C) 2026 Paul Esson
 * GPL-3.0
 *
 * This script tests the MCP server's lat/long location lookup functionality
 */

import { spawn } from 'child_process';

const serverPath = './dist/index.js';

function testLocationLookup() {
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
    console.error('Server log:', data.toString());
  });

  // Wait for server to initialize
  setTimeout(() => {
    // Test 1: List tools (verify get_location_stats is available)
    console.log('\n✓ Test 1: Listing tools...');
    server.stdin.write(
      JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/list',
        params: {},
        id: 1,
      }) + '\n'
    );
  }, 1000);

  setTimeout(() => {
    // Test 2: Lookup Sydney CBD by coordinates (-33.8688, 151.2093)
    console.log('\n✓ Test 2: Looking up Sydney CBD by coordinates (-33.8688, 151.2093)...');
    server.stdin.write(
      JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'get_location_stats',
          arguments: {
            latitude: -33.8688,
            longitude: 151.2093
          },
        },
        id: 2,
      }) + '\n'
    );
  }, 2000);

  setTimeout(() => {
    // Test 3: Lookup Melbourne by coordinates (-37.8136, 144.9631)
    console.log('\n✓ Test 3: Looking up Melbourne by coordinates (-37.8136, 144.9631)...');
    server.stdin.write(
      JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'get_location_stats',
          arguments: {
            latitude: -37.8136,
            longitude: 144.9631
          },
        },
        id: 3,
      }) + '\n'
    );
  }, 3000);

  setTimeout(() => {
    // Test 4: Lookup location near North Sydney (-33.84, 151.21)
    console.log('\n✓ Test 4: Looking up location near North Sydney (-33.84, 151.21)...');
    server.stdin.write(
      JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'get_location_stats',
          arguments: {
            latitude: -33.84,
            longitude: 151.21
          },
        },
        id: 4,
      }) + '\n'
    );
  }, 4000);

  setTimeout(() => {
    console.log('\n✓ All location lookup tests completed!');
    server.kill();
    process.exit(responses.length > 0 ? 0 : 1);
  }, 5500);
}

testLocationLookup();
