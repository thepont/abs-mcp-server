/*
 * abs-mcp-server
 * Copyright (C) 2026 Paul Esson
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */


/*
 * abs-mcp-server
 * Copyright (C) 2026 Paul Esson
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import fetch from 'node-fetch';

const ABS_API_BASE = 'https://api.data.abs.gov.au/data/';

// Helper to fetch SDMX-JSON and handle errors
async function fetchABSData(endpoint: string): Promise<any> {
  try {
    const res = await fetch(endpoint);
    if (!res.ok) throw new Error(`ABS API error: ${res.status}`);
    const data: any = await res.json();
    if (!data?.structure || !data?.dataSets) throw new Error('Malformed SDMX-JSON response');
    return data;
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

const server = new Server(
  {
    name: 'abs-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_suburb_stats',
        description: 'Get median weekly household income and total population for a given Australian postcode.',
        inputSchema: {
          type: 'object',
          properties: {
            postcode: {
              type: 'string',
              pattern: '^\\d{4}$',
              description: 'Australian postcode (4 digits)',
            },
          },
          required: ['postcode'],
        },
      },
      {
        name: 'get_mortgage_stress',
        description: 'Get household debt or mortgage-to-income ratios for a given region (postcode or area code).',
        inputSchema: {
          type: 'object',
          properties: {
            region: {
              type: 'string',
              description: 'Region (postcode or area code)',
            },
          },
          required: ['region'],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;

    if (name === 'get_suburb_stats') {
      const { postcode } = args as { postcode: string };
      const incomeEndpoint = `${ABS_API_BASE}explorer/INCOME/postcode/${postcode}`;
      const popEndpoint = `${ABS_API_BASE}explorer/POPULATION/postcode/${postcode}`;
      const [incomeData, popData] = await Promise.all([
        fetchABSData(incomeEndpoint),
        fetchABSData(popEndpoint)
      ]);
      if (incomeData.error || popData.error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${incomeData.error || popData.error}`,
            },
          ],
          isError: true,
        };
      }
      const income = incomeData.dataSets?.[0]?.series?.[0]?.observations?.[0]?.value ?? null;
      const population = popData.dataSets?.[0]?.series?.[0]?.observations?.[0]?.value ?? null;
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ postcode, median_weekly_household_income: income, total_population: population }, null, 2),
          },
        ],
      };
    }

    if (name === 'get_mortgage_stress') {
      const { region } = args as { region: string };
      const endpoint = `${ABS_API_BASE}explorer/MORTGAGE_STRESS/region/${region}`;
      const data = await fetchABSData(endpoint);
      if (data.error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${data.error}`,
            },
          ],
          isError: true,
        };
      }
      const stress = data.dataSets?.[0]?.series?.[0]?.observations?.[0]?.value ?? null;
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ region, mortgage_stress: stress }, null, 2),
          },
        ],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
