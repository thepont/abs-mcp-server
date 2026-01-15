/*
 * abs-mcp-server protocol test suite
 * Copyright (C) 2026 Paul Esson
 * GPL-3.0
 */
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import path from 'path';

describe('MCP Server Protocol', () => {
  let serverProcess: ChildProcessWithoutNullStreams;
  let stdoutData = '';
  const serverPath = path.resolve(__dirname, 'index.ts');

  beforeAll((done) => {
    serverProcess = spawn('ts-node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });
    serverProcess.stdout.on('data', (chunk: Buffer) => {
      stdoutData += chunk.toString();
    });
    setTimeout(done, 3000);
  });

  afterAll(() => {
    if (serverProcess) serverProcess.kill();
  });

  test('ListToolsRequest returns tools', (done) => {
    stdoutData = '';
    const req = {
      jsonrpc: '2.0',
      method: 'ListToolsRequest',
      params: {},
      id: 1,
    };
    serverProcess.stdin.write(JSON.stringify(req) + '\n');
    const checkResponse = () => {
      try {
        const lines = stdoutData.trim().split('\n');
        const lastLine = lines[lines.length - 1];
        if (!lastLine) return setTimeout(checkResponse, 100);
        const res = JSON.parse(lastLine);
        expect(res.result.tools).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: 'get_suburb_stats' }),
            expect.objectContaining({ name: 'get_mortgage_stress' }),
          ])
        );
        done();
      } catch (e) {
        setTimeout(checkResponse, 100);
      }
    };
    checkResponse();
  }, 30000);

  test('CallToolRequest get_suburb_stats', (done) => {
    stdoutData = '';
    const req = {
      jsonrpc: '2.0',
      method: 'CallToolRequest',
      params: {
        name: 'get_suburb_stats',
        arguments: { postcode: '2000' },
      },
      id: 2,
    };
    serverProcess.stdin.write(JSON.stringify(req) + '\n');
    const checkResponse = () => {
      try {
        const lines = stdoutData.trim().split('\n');
        const lastLine = lines[lines.length - 1];
        if (!lastLine) return setTimeout(checkResponse, 100);
        const res = JSON.parse(lastLine);
        expect(res.result.content[0].text).toMatch(/median_weekly_household_income/);
        done();
      } catch (e) {
        setTimeout(checkResponse, 100);
      }
    };
    checkResponse();
  }, 30000);

  test('CallToolRequest get_mortgage_stress', (done) => {
    stdoutData = '';
    const req = {
      jsonrpc: '2.0',
      method: 'CallToolRequest',
      params: {
        name: 'get_mortgage_stress',
        arguments: { region: '2000' },
      },
      id: 3,
    };
    serverProcess.stdin.write(JSON.stringify(req) + '\n');
    const checkResponse = () => {
      try {
        const lines = stdoutData.trim().split('\n');
        const lastLine = lines[lines.length - 1];
        if (!lastLine) return setTimeout(checkResponse, 100);
        const res = JSON.parse(lastLine);
        expect(res.result.content[0].text).toMatch(/mortgage_stress/);
        done();
      } catch (e) {
        setTimeout(checkResponse, 100);
      }
    };
    checkResponse();
  }, 30000);
});
