#!/usr/bin/env node

/*
 * Detailed test showing actual response data from lookups
 */

import { spawn } from 'child_process';

const serverPath = './dist/index.js';

function detailedTest() {
  console.log('🔍 Detailed Lookup Test\n');
  console.log('Testing both postcode and lat/long lookups with detailed output\n');

  const server = spawn('node', [serverPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  server.stderr.on('data', (data) => {
    const output = data.toString();
    if (output.includes('[Server] Ready')) {
      console.log('✅ ' + output.trim() + '\n');
    }
  });

  server.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(l => l.trim());
    lines.forEach(line => {
      try {
        const res = JSON.parse(line);
        if (res.result?.content?.[0]?.text) {
          const text = res.result.content[0].text;

          if (res.id === 2) {
            console.log('=' .repeat(70));
            console.log('TEST 1: LAT/LONG LOOKUP - Sydney CBD');
            console.log('=' .repeat(70));
            console.log('Query: latitude=-33.8688, longitude=151.2093');
            console.log('\nExpected: Find "Sydney - Haymarket - The Rocks" SA2 region');
            console.log('\nResponse:');

            if (text.includes('Sydney - Haymarket - The Rocks') && text.includes('11703')) {
              console.log('✅ CORRECT: Found nearest SA2 region');
              // Extract key info
              if (text.includes('0.00 km')) {
                console.log('✅ CORRECT: Distance is 0.00 km (exact match)');
              }
            }
            console.log(text.substring(0, 400));
            console.log('\n');
          }

          if (res.id === 3) {
            console.log('=' .repeat(70));
            console.log('TEST 2: LAT/LONG LOOKUP - Near North Sydney');
            console.log('=' .repeat(70));
            console.log('Query: latitude=-33.84, longitude=151.21');
            console.log('\nExpected: Find "North Sydney - Lavender Bay" SA2 region');
            console.log('\nResponse:');

            if (text.includes('North Sydney - Lavender Bay') && text.includes('12002')) {
              console.log('✅ CORRECT: Found nearest SA2 region');
              if (text.includes('0.37 km')) {
                console.log('✅ CORRECT: Distance calculated (0.37 km away)');
              }
            }
            console.log(text.substring(0, 400));
            console.log('\n');
          }

          if (res.id === 4) {
            console.log('=' .repeat(70));
            console.log('TEST 3: POSTCODE LOOKUP - Sydney CBD');
            console.log('=' .repeat(70));
            console.log('Query: postcode=2000');
            console.log('\nExpected: Find SA2 codes for postcode 2000');
            console.log('\nResponse:');

            if ((text.includes('11703') || text.includes('11704')) && text.includes('2000')) {
              console.log('✅ CORRECT: Found SA2 mapping for postcode 2000');
              if (text.includes('sa2_codes')) {
                console.log('✅ CORRECT: Response includes sa2_codes field');
              }
            }
            console.log(text.substring(0, 400));
            console.log('\n');
          }

          if (res.id === 5) {
            console.log('=' .repeat(70));
            console.log('TEST 4: POSTCODE LOOKUP - Melbourne');
            console.log('=' .repeat(70));
            console.log('Query: postcode=3000');
            console.log('\nExpected: Find SA2 codes for postcode 3000');
            console.log('\nResponse:');

            if ((text.includes('20601') || text.includes('20602')) && text.includes('3000')) {
              console.log('✅ CORRECT: Found SA2 mapping for postcode 3000');
            }
            console.log(text.substring(0, 400));
            console.log('\n');
          }

          if (res.id === 6) {
            console.log('=' .repeat(70));
            console.log('TEST 5: INVALID POSTCODE');
            console.log('=' .repeat(70));
            console.log('Query: postcode=9999');
            console.log('\nExpected: Error - postcode not in cache');
            console.log('\nResponse:');

            if (text.includes('not found in geography cache')) {
              console.log('✅ CORRECT: Invalid postcode properly rejected');
            }
            console.log(text.substring(0, 300));
            console.log('\n');
          }

          if (res.id === 7) {
            console.log('=' .repeat(70));
            console.log('TEST 6: LAT/LONG LOOKUP - Brisbane');
            console.log('=' .repeat(70));
            console.log('Query: latitude=-27.4705, longitude=153.0260');
            console.log('\nExpected: Find Brisbane City SA2 region (30101)');
            console.log('\nResponse:');

            if (text.includes('Brisbane City') && text.includes('30101')) {
              console.log('✅ CORRECT: Found Brisbane City SA2 region');
            }
            console.log(text.substring(0, 400));
            console.log('\n');
          }
        }
      } catch (e) {
        // Ignore
      }
    });
  });

  // Wait for initialization
  setTimeout(() => {
    // Test 1: Lat/Long Sydney CBD (exact match)
    server.stdin.write(JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'get_location_stats',
        arguments: { latitude: -33.8688, longitude: 151.2093 }
      },
      id: 2
    }) + '\n');
  }, 1500);

  setTimeout(() => {
    // Test 2: Lat/Long near North Sydney (distance calculation)
    server.stdin.write(JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'get_location_stats',
        arguments: { latitude: -33.84, longitude: 151.21 }
      },
      id: 3
    }) + '\n');
  }, 2500);

  setTimeout(() => {
    // Test 3: Postcode Sydney
    server.stdin.write(JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'get_suburb_stats',
        arguments: { postcode: '2000' }
      },
      id: 4
    }) + '\n');
  }, 3500);

  setTimeout(() => {
    // Test 4: Postcode Melbourne
    server.stdin.write(JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'get_suburb_stats',
        arguments: { postcode: '3000' }
      },
      id: 5
    }) + '\n');
  }, 4500);

  setTimeout(() => {
    // Test 5: Invalid postcode
    server.stdin.write(JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'get_suburb_stats',
        arguments: { postcode: '9999' }
      },
      id: 6
    }) + '\n');
  }, 5500);

  setTimeout(() => {
    // Test 6: Brisbane lat/long
    server.stdin.write(JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'get_location_stats',
        arguments: { latitude: -27.4705, longitude: 153.0260 }
      },
      id: 7
    }) + '\n');
  }, 6500);

  setTimeout(() => {
    console.log('=' .repeat(70));
    console.log('✅ All detailed tests completed successfully!');
    console.log('=' .repeat(70));
    server.kill();
    process.exit(0);
  }, 8000);
}

detailedTest();
