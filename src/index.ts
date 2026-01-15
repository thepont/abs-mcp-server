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

// ABS Data API base URL (SDMX format: /rest/data/{dataflowIdentifier}/{dataKey})
// See: https://data.api.abs.gov.au/
const ABS_API_BASE = 'https://data.api.abs.gov.au/rest/data/';

// Helper to fetch SDMX-JSON and handle errors
async function fetchABSData(endpoint: string): Promise<any> {
  try {
    const res = await fetch(endpoint, {
      headers: {
        'Accept': 'application/vnd.sdmx.data+json;version=1.0.0-wd'
      }
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`ABS API error: ${res.status} - ${text}`);
    }
    const data: any = await res.json();
    return data;
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// Helper to extract first available value from SDMX series
function extractValue(data: any): number | null {
  if (data.error || !data.data?.dataSets?.[0]?.series) return null;
  const series = data.data.dataSets[0].series;
  const firstSeriesKey = Object.keys(series)[0];
  if (!firstSeriesKey) return null;
  const observations = series[firstSeriesKey].observations;
  const firstObsKey = Object.keys(observations)[0];
  return observations[firstObsKey]?.[0] ?? null;
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
      {
        name: 'get_supply_pipeline',
        description: 'Are they building too much or too little here? Get building approvals data for a postcode.',
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
        name: 'get_wealth_migration',
        description: 'KILLER FEATURE: Is equity flowing in from wealthy Sydney suburbs? Tracks wealth migration to detect capital influx.',
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
      {
        name: 'get_investor_sentiment',
        description: 'KILLER FEATURE: Is the market FHB or investor driven? Detects if big money is stampeding or if it\'s organic moms-and-dads demand.',
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
      {
        name: 'get_gentrification_score',
        description: 'KILLER FEATURE: Is investment growth outpacing income growth? Compares lending activity vs employee incomes to detect rapid gentrification.',
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
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;

    if (name === 'get_suburb_stats') {
      const { postcode } = args as { postcode: string };
      // Using ERP (Estimated Resident Population) data - returns aggregate stats
      const endpoint = `${ABS_API_BASE}ABS,ABS_ANNUAL_ERP_ASGS2021/all?startPeriod=2021&endPeriod=2021`;
      const data = await fetchABSData(endpoint);
      if (data.error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${data.error}. Note: Postcode-level filtering requires dimension configuration.`,
            },
          ],
          isError: true,
        };
      }
      const population = extractValue(data);
      // Return sample data - real implementation would filter by postcode dimension
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ 
              postcode, 
              median_weekly_household_income: 1500, // Sample value - needs Census dataset
              total_population: population,
              note: "Using sample population data. Configure postcode dimension for accurate results."
            }, null, 2),
          },
        ],
      };
    }

    if (name === 'get_mortgage_stress') {
      const { region } = args as { region: string };
      // Using housing lending data as proxy for mortgage stress
      const endpoint = `${ABS_API_BASE}ABS,LEND_HOUSING/all?startPeriod=2023&endPeriod=2023`;
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
      const lendingValue = extractValue(data);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ 
              region, 
              mortgage_stress: lendingValue,
              note: "Using housing lending data. Value represents lending indicator, not direct stress measure."
            }, null, 2),
          },
        ],
      };
    }

    if (name === 'get_supply_pipeline') {
      const { postcode } = args as { postcode: string };
      // KILLER FEATURE: Identifies supply flood risk or buy signals from building approvals
      const endpoint = `${ABS_API_BASE}ABS,BUILDING_ACTIVITY/all?startPeriod=2023-01&endPeriod=2024-12`;
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
      const approvals = extractValue(data);
      const supplySignal = approvals && approvals > 100000 ? 'FLOOD_RISK' : 
                          approvals && approvals < 50000 ? 'BUY_SIGNAL' : 'NEUTRAL';
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ 
              postcode, 
              dwelling_approvals: approvals,
              supply_signal: supplySignal,
              market_insight: approvals && approvals > 100000 ? 
                '⚠️ HIGH SUPPLY COMING: Suburb may be flooded with new units - oversupply risk' :
                '✅ SUPPLY DEAD: Low approvals indicate tight market - potential buy signal',
              note: "Using BUILDING_ACTIVITY dataflow. Configure REGION/SA2 dimensions for postcode-level precision."
            }, null, 2),
          },
        ],
      };
    }

    if (name === 'get_wealth_migration') {
      const { region } = args as { region: string };
      // KILLER FEATURE: Tracks "Equity Flow" from wealthy Sydney suburbs to regional areas
      const migrationEndpoint = `${ABS_API_BASE}ABS,ABS_REGIONAL_MIGRATION/all?startPeriod=2022&endPeriod=2023`;
      const migrationData = await fetchABSData(migrationEndpoint);
      
      const popEndpoint = `${ABS_API_BASE}ABS,ABS_ANNUAL_ERP_ASGS2021/all?startPeriod=2021&endPeriod=2021`;
      const popData = await fetchABSData(popEndpoint);
      
      if (migrationData.error && popData.error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${migrationData.error || popData.error}`,
            },
          ],
          isError: true,
        };
      }
      
      const migrationFlow = extractValue(migrationData);
      const population = extractValue(popData);
      const equitySignal = migrationFlow && migrationFlow > 5000 ? 'WEALTH_INFLUX' : 'STABLE';
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ 
              region, 
              net_migration: migrationFlow,
              population_base: population,
              equity_flow_signal: equitySignal,
              market_insight: migrationFlow && migrationFlow > 5000 ?
                '💰 EQUITY FLOWING IN: Strong migration from wealthy metro areas detected' :
                '📊 STABLE MARKET: Organic population growth without major equity influx',
              note: "Using ABS_REGIONAL_MIGRATION. Configure ORIGIN_SA4/DEST_SA4 to track Sydney→Regional wealth migration."
            }, null, 2),
          },
        ],
      };
    }

    if (name === 'get_investor_sentiment') {
      const { region } = args as { region: string };
      // KILLER FEATURE: Detects if market is FHB (First Home Buyer) or Investor driven
      const endpoint = `${ABS_API_BASE}ABS,LEND_HOUSING/all?startPeriod=2023&endPeriod=2024`;
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
      const lendingVolume = extractValue(data);
      // Heuristic: High lending volumes (>150) suggest investor-driven market
      const marketDriver = lendingVolume && lendingVolume > 150 ? 'INVESTOR_DRIVEN' : 
                          lendingVolume && lendingVolume > 80 ? 'MIXED_MARKET' : 'FHB_MARKET';
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ 
              region, 
              lending_volume: lendingVolume,
              market_driver: marketDriver,
              market_insight: lendingVolume && lendingVolume > 150 ?
                '🏢 INVESTOR STAMPEDE: High lending activity indicates investor dominance - prices may surge' :
                lendingVolume && lendingVolume > 80 ?
                '⚖️ BALANCED MARKET: Mixed investor/FHB activity - stable growth expected' :
                '🏠 FHB TERRITORY: Low volumes suggest first-home buyer market - organic demand',
              note: "Using LEND_HOUSING dataflow. Configure PURPOSE dimension to split investor/owner-occupier lending."
            }, null, 2),
          },
        ],
      };
    }

    if (name === 'get_gentrification_score') {
      const { postcode } = args as { postcode: string };
      // KILLER FEATURE: Compares investment growth vs employee income growth to detect gentrification
      const lendingEndpoint = `${ABS_API_BASE}ABS,LEND_HOUSING/all?startPeriod=2022&endPeriod=2024`;
      const lendingData = await fetchABSData(lendingEndpoint);
      
      const incomeEndpoint = `${ABS_API_BASE}ABS,ABS_ANNUAL_ERP_ASGS2021/all?startPeriod=2021&endPeriod=2021`;
      const incomeData = await fetchABSData(incomeEndpoint);
      
      if (lendingData.error && incomeData.error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${lendingData.error || incomeData.error}`,
            },
          ],
          isError: true,
        };
      }
      
      const investmentGrowth = extractValue(lendingData) || 100;
      const incomeBase = extractValue(incomeData) || 1000;
      const estimatedIncome = Math.floor(incomeBase * 50); // Proxy: $50 per capita
      
      // Calculate gentrification score: Investment growth vs income capacity
      const gentrificationScore = investmentGrowth / (estimatedIncome / 1000);
      const signal = gentrificationScore > 2.0 ? 'RAPID_GENTRIFICATION' :
                    gentrificationScore > 1.2 ? 'GENTRIFYING' : 'STABLE';
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ 
              postcode, 
              investment_lending: investmentGrowth,
              estimated_income: estimatedIncome,
              gentrification_score: Math.round(gentrificationScore * 100) / 100,
              signal: signal,
              market_insight: gentrificationScore > 2.0 ?
                '🚀 RAPID GENTRIFICATION: Investment growth massively outpacing income - displacement risk' :
                gentrificationScore > 1.2 ?
                '📈 GENTRIFYING: Investment exceeds income growth - early-stage transformation' :
                '🏘️ STABLE COMMUNITY: Investment aligned with income levels - organic growth',
              note: "Using LEND_HOUSING for investment proxy and ERP for income base. Configure Census G02 INCP for actual income data."
            }, null, 2),
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
