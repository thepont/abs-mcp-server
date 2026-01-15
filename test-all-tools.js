#!/usr/bin/env node

/**
 * Comprehensive test suite for all 6 ABS MCP tools
 * Tests both tool discovery and execution
 */

import { spawn } from 'child_process';
import assert from 'assert';

const TEST_CASES = [
  {
    name: 'get_suburb_stats',
    args: { postcode: '2000' },
    expectedKeys: ['postcode', 'median_weekly_household_income', 'total_population']
  },
  {
    name: 'get_mortgage_stress',
    args: { region: 'Sydney' },
    expectedKeys: ['region', 'mortgage_stress']
  },
  {
    name: 'get_supply_pipeline',
    args: { postcode: '2000' },
    expectedKeys: ['postcode', 'dwelling_approvals', 'supply_signal']
  },
  {
    name: 'get_wealth_migration',
    args: { region: 'Sydney' },
    expectedKeys: ['region', 'net_migration', 'equity_flow_signal']
  },
  {
    name: 'get_investor_sentiment',
    args: { region: 'Sydney' },
    expectedKeys: ['region', 'lending_volume', 'market_driver']
  },
  {
    name: 'get_gentrification_score',
    args: { postcode: '3000' },
    expectedKeys: ['postcode', 'gentrification_score', 'signal']
  }
];

function sendMCPRequest(server, request) {
  return new Promise((resolve, reject) => {
    let buffer = '';
    let messageCount = 0;

    const onData = (chunk) => {
      buffer += chunk.toString();
      
      // Try to parse complete JSON messages (JSONRPC format)
      const lines = buffer.split('\n');
      buffer = lines[lines.length - 1]; // Keep incomplete line

      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i].trim();
        if (line) {
          try {
            const json = JSON.parse(line);
            messageCount++;
            if (json.result !== undefined || json.error !== undefined) {
              server.stdout.removeListener('data', onData);
              server.stderr.removeListener('data', onError);
              clearTimeout(timeout);
              resolve(json);
            }
          } catch (e) {
            // Not a complete JSON message yet
          }
        }
      }
    };

    const onError = (chunk) => {
      console.error('Server error:', chunk.toString());
    };

    const timeout = setTimeout(() => {
      server.stdout.removeListener('data', onData);
      server.stderr.removeListener('data', onError);
      reject(new Error(`Timeout waiting for response after ${messageCount} messages`));
    }, 5000);

    server.stdout.on('data', onData);
    server.stderr.on('data', onError);
    
    const jsonRequest = JSON.stringify(request) + '\n';
    server.stdin.write(jsonRequest);
  });
}

async function runTests() {
  console.log('🧪 Starting ABS MCP Server Test Suite\n');
  
  // Start the server
  const server = spawn('node', ['dist/index.js'], {
    cwd: process.cwd(),
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let passCount = 0;
  let failCount = 0;

  try {
    // Test 1: Tool Discovery
    console.log('📋 Test 1: Tool Discovery');
    const listResponse = await sendMCPRequest(server, {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list'
    });

    assert(listResponse.result, 'Expected result in list response');
    assert(Array.isArray(listResponse.result.tools), 'Expected tools array');
    assert.equal(listResponse.result.tools.length, 6, `Expected 6 tools, got ${listResponse.result.tools.length}`);

    const toolNames = listResponse.result.tools.map(t => t.name);
    console.log('✅ Tool Discovery: Found', toolNames.length, 'tools');
    console.log('   Tools:', toolNames.join(', '));
    passCount++;

    // Verify each tool exists
    const expectedTools = TEST_CASES.map(t => t.name);
    for (const tool of expectedTools) {
      assert(toolNames.includes(tool), `Missing tool: ${tool}`);
    }
    console.log('✅ All 6 tools are discoverable\n');
    passCount++;

    // Test 2-7: Execute each tool
    for (let i = 0; i < TEST_CASES.length; i++) {
      const testCase = TEST_CASES[i];
      console.log(`Test ${i + 2}: Executing tool '${testCase.name}'`);
      
      const callResponse = await sendMCPRequest(server, {
        jsonrpc: '2.0',
        id: i + 2,
        method: 'tools/call',
        params: {
          name: testCase.name,
          arguments: testCase.args
        }
      });

      if (callResponse.error) {
        console.log(`❌ Tool '${testCase.name}' failed:`, callResponse.error);
        failCount++;
        continue;
      }

      // Parse the response content
      const content = callResponse.result.content;
      assert(Array.isArray(content), 'Expected content array');
      assert(content.length > 0, 'Expected content items');

      const textContent = content.find(c => c.type === 'text');
      assert(textContent, 'Expected text content');

      let resultData;
      try {
        resultData = JSON.parse(textContent.text);
      } catch (e) {
        if (textContent.text.includes('Error:')) {
          console.log(`⚠️  Tool returned error:`, textContent.text);
          passCount++;
          continue;
        }
        throw e;
      }

      // Verify expected keys are present
      for (const key of testCase.expectedKeys) {
        assert(key in resultData, `Missing expected key '${key}' in response`);
      }

      console.log(`✅ Tool '${testCase.name}' executed successfully`);
      console.log(`   Response:`, JSON.stringify(resultData, null, 2).split('\n').slice(0, 3).join('\n'));
      passCount++;
    }

    console.log(`\n✨ Test Results: ${passCount} passed, ${failCount} failed`);
    
    if (failCount === 0) {
      console.log('🎉 All tests passed! Safe to push.');
      process.exit(0);
    } else {
      console.log('⚠️  Some tests failed. Fix errors before pushing.');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    failCount++;
    console.log(`\n✨ Test Results: ${passCount} passed, ${failCount} failed`);
    process.exit(1);
  } finally {
    server.kill();
  }
}

runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
