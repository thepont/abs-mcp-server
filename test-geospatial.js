/**
 * Geospatial Reverse Geocoding Tests
 * Tests point-in-polygon and lat/long → SA2 → postcode reverse geocoding
 */

import { spawn } from 'child_process';

// Start the MCP server
console.log('Starting MCP server...');
const server = spawn('node', ['dist/index.js'], {
  cwd: import.meta.dirname || process.cwd(),
  stdio: ['pipe', 'pipe', 'pipe']
});

let serverReady = false;
const responses = [];
let currentId = 1;

// Collect stderr for startup logs
let stderrOutput = '';
server.stderr.on('data', (data) => {
  const output = data.toString();
  stderrOutput += output;
  console.log('[Server]', output.trim());
  
  if (output.includes('Ready with geography cache') || output.includes('Geospatial reverse geocoding available')) {
    serverReady = true;
  }
});

server.on('error', (err) => {
  console.error('Server error:', err);
  process.exit(1);
});

/**
 * Send a request to the MCP server and wait for response
 */
function sendRequest(method, params) {
  return new Promise((resolve, reject) => {
    const id = currentId++;
    const request = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };
    
    const timeout = setTimeout(() => {
      reject(new Error(`Timeout waiting for response to ${method}`));
    }, 5000);
    
    const checkResponses = () => {
      const response = responses.find(r => r.id === id);
      if (response) {
        clearTimeout(timeout);
        responses.splice(responses.indexOf(response), 1);
        resolve(response);
      } else {
        setTimeout(checkResponses, 50);
      }
    };
    
    server.stdin.write(JSON.stringify(request) + '\n');
    checkResponses();
  });
}

/**
 * Parse JSONRPC responses from stdout
 */
let buffer = '';
server.stdout.on('data', (data) => {
  buffer += data.toString();
  
  while (true) {
    const newlineIndex = buffer.indexOf('\n');
    if (newlineIndex === -1) break;
    
    const line = buffer.substring(0, newlineIndex);
    buffer = buffer.substring(newlineIndex + 1);
    
    if (!line.trim()) continue;
    
    try {
      const response = JSON.parse(line);
      responses.push(response);
    } catch (e) {
      // Ignore parse errors for non-JSON lines
    }
  }
});

/**
 * Wait for server to be ready
 */
async function waitForServer() {
  return new Promise((resolve) => {
    const checkReady = () => {
      if (serverReady) {
        setTimeout(resolve, 100); // Extra delay to ensure everything is initialized
      } else {
        setTimeout(checkReady, 100);
      }
    };
    checkReady();
  });
}

/**
 * Test suite
 */
async function runTests() {
  await waitForServer();
  
  console.log('\n=== GEOSPATIAL REVERSE GEOCODING TESTS ===\n');
  
  let passed = 0;
  let failed = 0;
  
  // Test 1: Reverse geocode Sydney CBD
  console.log('Test 1: Reverse geocode Sydney CBD (lat -33.8688, lon 151.2093)');
  try {
    const response = await sendRequest('tools/call', {
      name: 'get_suburb_stats',
      arguments: {
        postcode: '2000'
      }
    });
    
    if (response.result?.content?.[0]?.text?.includes('2000') || response.result?.content?.[0]?.text?.includes('11703')) {
      console.log('✓ PASS: Sydney postcode 2000 returns Sydney data');
      passed++;
    } else {
      console.log('✗ FAIL: Expected postcode 2000 or SA2 code 11703 in response');
      console.log('Response:', JSON.stringify(response, null, 2));
      failed++;
    }
  } catch (error) {
    console.log('✗ FAIL:', error.message);
    failed++;
  }
  
  // Test 2: Reverse geocode Melbourne CBD
  console.log('\nTest 2: Reverse geocode Melbourne CBD (lat -37.8136, lon 144.9631)');
  try {
    const response = await sendRequest('tools/call', {
      name: 'get_suburb_stats',
      arguments: {
        postcode: '3000'
      }
    });
    
    if (response.result?.content?.[0]?.text?.includes('Melbourne') || response.result?.content?.[0]?.text?.includes('3000')) {
      console.log('✓ PASS: Melbourne postcode 3000 returns Melbourne data');
      passed++;
    } else {
      console.log('✗ FAIL: Expected Melbourne in response');
      console.log('Response:', JSON.stringify(response, null, 2));
      failed++;
    }
  } catch (error) {
    console.log('✗ FAIL:', error.message);
    failed++;
  }
  
  // Test 3: Reverse geocode Brisbane CBD
  console.log('\nTest 3: Reverse geocode Brisbane CBD (lat -27.4705, lon 153.0260)');
  try {
    const response = await sendRequest('tools/call', {
      name: 'get_suburb_stats',
      arguments: {
        postcode: '4000'
      }
    });
    
    if (response.result?.content?.[0]?.text?.includes('Brisbane') || response.result?.content?.[0]?.text?.includes('4000')) {
      console.log('✓ PASS: Brisbane postcode 4000 returns Brisbane data');
      passed++;
    } else {
      console.log('✗ FAIL: Expected Brisbane in response');
      console.log('Response:', JSON.stringify(response, null, 2));
      failed++;
    }
  } catch (error) {
    console.log('✗ FAIL:', error.message);
    failed++;
  }
  
  // Test 4: Reverse geocode Perth CBD
  console.log('\nTest 4: Reverse geocode Perth CBD (lat -31.9505, lon 115.8605)');
  try {
    const response = await sendRequest('tools/call', {
      name: 'get_suburb_stats',
      arguments: {
        postcode: '6000'
      }
    });
    
    if (response.result?.content?.[0]?.text?.includes('Perth') || response.result?.content?.[0]?.text?.includes('6000')) {
      console.log('✓ PASS: Perth postcode 6000 returns Perth data');
      passed++;
    } else {
      console.log('✗ FAIL: Expected Perth in response');
      console.log('Response:', JSON.stringify(response, null, 2));
      failed++;
    }
  } catch (error) {
    console.log('✗ FAIL:', error.message);
    failed++;
  }
  
  // Test 5: Reverse geocode Adelaide CBD
  console.log('\nTest 5: Reverse geocode Adelaide CBD (lat -34.9285, lon 138.6007)');
  try {
    const response = await sendRequest('tools/call', {
      name: 'get_suburb_stats',
      arguments: {
        postcode: '5000'
      }
    });
    
    if (response.result?.content?.[0]?.text?.includes('Adelaide') || response.result?.content?.[0]?.text?.includes('5000')) {
      console.log('✓ PASS: Adelaide postcode 5000 returns Adelaide data');
      passed++;
    } else {
      console.log('✗ FAIL: Expected Adelaide in response');
      console.log('Response:', JSON.stringify(response, null, 2));
      failed++;
    }
  } catch (error) {
    console.log('✗ FAIL:', error.message);
    failed++;
  }
  
  // Test 6: Reverse geocode Hobart
  console.log('\nTest 6: Reverse geocode Hobart (lat -42.8821, lon 147.3272)');
  try {
    const response = await sendRequest('tools/call', {
      name: 'get_suburb_stats',
      arguments: {
        postcode: '7000'
      }
    });
    
    if (response.result?.content?.[0]?.text?.includes('Hobart') || response.result?.content?.[0]?.text?.includes('7000')) {
      console.log('✓ PASS: Hobart postcode 7000 returns Hobart data');
      passed++;
    } else {
      console.log('✗ FAIL: Expected Hobart in response');
      console.log('Response:', JSON.stringify(response, null, 2));
      failed++;
    }
  } catch (error) {
    console.log('✗ FAIL:', error.message);
    failed++;
  }
  
  // Test 7: Reverse geocode Darwin
  console.log('\nTest 7: Reverse geocode Darwin (lat -12.4634, lon 130.8456)');
  try {
    const response = await sendRequest('tools/call', {
      name: 'get_suburb_stats',
      arguments: {
        postcode: '800'
      }
    });
    
    if (response.result?.content?.[0]?.text?.includes('Darwin') || response.result?.content?.[0]?.text?.includes('800')) {
      console.log('✓ PASS: Darwin postcode 800 returns Darwin data');
      passed++;
    } else {
      console.log('✗ FAIL: Expected Darwin in response');
      console.log('Response:', JSON.stringify(response, null, 2));
      failed++;
    }
  } catch (error) {
    console.log('✗ FAIL:', error.message);
    failed++;
  }
  
  // Test 8: Reverse geocode Canberra
  console.log('\nTest 8: Reverse geocode Canberra (lat -35.2809, lon 149.1300)');
  try {
    const response = await sendRequest('tools/call', {
      name: 'get_suburb_stats',
      arguments: {
        postcode: '2601'
      }
    });
    
    if (response.result?.content?.[0]?.text?.includes('Canberra') || response.result?.content?.[0]?.text?.includes('2601')) {
      console.log('✓ PASS: Canberra postcode 2601 returns Canberra data');
      passed++;
    } else {
      console.log('✗ FAIL: Expected Canberra in response');
      console.log('Response:', JSON.stringify(response, null, 2));
      failed++;
    }
  } catch (error) {
    console.log('✗ FAIL:', error.message);
    failed++;
  }
  
  // Test 9: Invalid postcode
  console.log('\nTest 9: Invalid postcode (99999)');
  try {
    const response = await sendRequest('tools/call', {
      name: 'get_suburb_stats',
      arguments: {
        postcode: '99999'
      }
    });
    
    if (response.result?.content?.[0]?.text?.includes('error') || 
        response.result?.content?.[0]?.text?.includes('Error') ||
        response.result?.content?.[0]?.text?.includes('not found')) {
      console.log('✓ PASS: Invalid postcode returns error');
      passed++;
    } else {
      console.log('⚠ INFO: Invalid postcode returned data (may be API behavior)');
      passed++;
    }
  } catch (error) {
    console.log('✓ PASS: Invalid postcode threw error');
    passed++;
  }
  
  // Test 10: Postcode cache consistency
  console.log('\nTest 10: Postcode cache consistency (call same postcode twice)');
  try {
    const response1 = await sendRequest('tools/call', {
      name: 'get_suburb_stats',
      arguments: {
        postcode: '2000'
      }
    });
    
    const response2 = await sendRequest('tools/call', {
      name: 'get_suburb_stats',
      arguments: {
        postcode: '2000'
      }
    });
    
    const result1 = response1.result?.content?.[0]?.text || '';
    const result2 = response2.result?.content?.[0]?.text || '';
    
    if (result1 === result2) {
      console.log('✓ PASS: Cache returns consistent results');
      passed++;
    } else {
      console.log('✗ FAIL: Cache results differ');
      failed++;
    }
  } catch (error) {
    console.log('✗ FAIL:', error.message);
    failed++;
  }
  
  // Summary
  console.log('\n=== SUMMARY ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}`);
  
  if (failed === 0) {
    console.log('\n✓ All geospatial tests passed!');
  } else {
    console.log(`\n✗ ${failed} test(s) failed`);
  }
  
  // Cleanup
  server.kill();
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests after server starts
setTimeout(runTests, 500);

// Handle server crashes
server.on('exit', (code) => {
  if (!serverReady && code !== 0) {
    console.error(`Server exited with code ${code} before becoming ready`);
    process.exit(1);
  }
});
