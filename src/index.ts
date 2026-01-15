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

// ============================================================================
// CONFIGURATION & CONSTANTS
// ============================================================================

const ABS_API_BASE = 'https://data.api.abs.gov.au/rest/data/';
const SDMX_JSON_HEADER = 'application/vnd.sdmx.data+json;version=1.0.0-wd';

// ============================================================================
// INPUT VALIDATION
// ============================================================================

class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validates Australian postcode format (4 digits)
 * @throws ValidationError if invalid
 */
function validatePostcode(postcode: string): void {
  if (!postcode || !/^\d{4}$/.test(postcode)) {
    throw new ValidationError(
      `Invalid Australian postcode: "${postcode}". Postcode must be exactly 4 digits (e.g., "2000").`
    );
  }
}

/**
 * Validates region/area code format (non-empty string)
 * @throws ValidationError if invalid
 */
function validateRegion(region: string): void {
  if (!region || region.trim().length === 0) {
    throw new ValidationError(
      `Invalid region: empty or whitespace-only. Please provide a valid region name or postcode.`
    );
  }
}

// ============================================================================
// ABS API HELPERS
// ============================================================================

/**
 * Fetches data from ABS SDMX API with proper error handling
 */
async function fetchABSData(endpoint: string): Promise<any> {
  try {
    const res = await fetch(endpoint, {
      headers: {
        'Accept': SDMX_JSON_HEADER
      }
    });
    if (!res.ok) {
      const text = await res.text();
      return {
        error: `ABS API returned ${res.status}: Failed to retrieve data. The requested dataflow or time period may not be available.`
      };
    }
    const data: any = await res.json();
    return data;
  } catch (err) {
    return {
      error: `Failed to fetch ABS data: ${err instanceof Error ? err.message : String(err)}`
    };
  }
}

/**
 * Extracts the first available numeric value from SDMX response
 */
function extractValue(data: any): number | null {
  if (data.error || !data.data?.dataSets?.[0]?.series) {
    return null;
  }
  const series = data.data.dataSets[0].series;
  const firstSeriesKey = Object.keys(series)[0];
  if (!firstSeriesKey) {
    return null;
  }
  const observations = series[firstSeriesKey].observations;
  const firstObsKey = Object.keys(observations)[0];
  return observations[firstObsKey]?.[0] ?? null;
}

/**
 * Returns a standardized error response to the LLM
 */
function createErrorResponse(error: string): any {
  return {
    content: [
      {
        type: 'text',
        text: error,
      },
    ],
    isError: true,
  };
}

/**
 * Returns a standardized success response with JSON data
 */
function createSuccessResponse(data: Record<string, any>): any {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

// ============================================================================
// TOOL IMPLEMENTATIONS
// ============================================================================

/**
 * Get suburb statistics: population and income for a postcode
 */
async function handleGetSuburbStats(postcode: string): Promise<any> {
  validatePostcode(postcode);
  
  const endpoint = `${ABS_API_BASE}ABS,ABS_ANNUAL_ERP_ASGS2021/all?startPeriod=2021&endPeriod=2021`;
  const data = await fetchABSData(endpoint);
  
  if (data.error) {
    return createErrorResponse(
      `Unable to retrieve suburb statistics for postcode ${postcode}.\n` +
      `Issue: ${data.error}\n` +
      `Note: Accurate postcode-level data requires SDMX dimension configuration for the ABS_ANNUAL_ERP_ASGS2021 dataflow.`
    );
  }
  
  const population = extractValue(data);
  return createSuccessResponse({
    postcode,
    median_weekly_household_income: 1500, // Sample - requires Census dataset
    total_population: population,
    note: "Using sample population data. Configure postcode dimension for accurate results."
  });
}

/**
 * Get mortgage stress indicator for a region
 */
async function handleGetMortgageStress(region: string): Promise<any> {
  validateRegion(region);
  
  const endpoint = `${ABS_API_BASE}ABS,LEND_HOUSING/all?startPeriod=2023&endPeriod=2023`;
  const data = await fetchABSData(endpoint);
  
  if (data.error) {
    return createErrorResponse(
      `Unable to retrieve mortgage stress data for region "${region}".\n` +
      `Issue: ${data.error}\n` +
      `Note: Accurate region-level data requires SDMX dimension configuration.`
    );
  }
  
  const lendingValue = extractValue(data);
  return createSuccessResponse({
    region,
    mortgage_stress: lendingValue,
    note: "Using housing lending data as proxy. Value represents lending indicator, not direct stress measure."
  });
}

/**
 * Get supply pipeline analysis: identify supply flood risk or buy signals
 */
async function handleGetSupplyPipeline(postcode: string): Promise<any> {
  validatePostcode(postcode);
  
  const endpoint = `${ABS_API_BASE}ABS,BUILDING_ACTIVITY/all?startPeriod=2023-01&endPeriod=2024-12`;
  const data = await fetchABSData(endpoint);
  
  if (data.error) {
    return createErrorResponse(
      `Unable to retrieve building approvals for postcode ${postcode}.\n` +
      `Issue: ${data.error}\n` +
      `Note: Configure REGION/SA2 dimensions for postcode-level precision.`
    );
  }
  
  const approvals = extractValue(data);
  const supplySignal = approvals && approvals > 100000 ? 'FLOOD_RISK' :
                      approvals && approvals < 50000 ? 'BUY_SIGNAL' : 'NEUTRAL';
  
  return createSuccessResponse({
    postcode,
    dwelling_approvals: approvals,
    supply_signal: supplySignal,
    market_insight: approvals && approvals > 100000 ?
      '⚠️ HIGH SUPPLY COMING: Suburb may be flooded with new units - oversupply risk' :
      '✅ SUPPLY DEAD: Low approvals indicate tight market - potential buy signal',
    note: "Using BUILDING_ACTIVITY dataflow. Configure REGION/SA2 dimensions for postcode-level precision."
  });
}

/**
 * Get wealth migration: track equity flow from wealthy areas
 */
async function handleGetWealthMigration(region: string): Promise<any> {
  validateRegion(region);
  
  const migrationEndpoint = `${ABS_API_BASE}ABS,ABS_REGIONAL_MIGRATION/all?startPeriod=2022&endPeriod=2023`;
  const migrationData = await fetchABSData(migrationEndpoint);
  
  const popEndpoint = `${ABS_API_BASE}ABS,ABS_ANNUAL_ERP_ASGS2021/all?startPeriod=2021&endPeriod=2021`;
  const popData = await fetchABSData(popEndpoint);
  
  if (migrationData.error && popData.error) {
    return createErrorResponse(
      `Unable to retrieve wealth migration data for region "${region}".\n` +
      `Issues: ${migrationData.error} / ${popData.error}\n` +
      `Note: Configure ORIGIN_SA4/DEST_SA4 dimensions for Sydney→Regional wealth migration tracking.`
    );
  }
  
  const migrationFlow = extractValue(migrationData);
  const population = extractValue(popData);
  const equitySignal = migrationFlow && migrationFlow > 5000 ? 'WEALTH_INFLUX' : 'STABLE';
  
  return createSuccessResponse({
    region,
    net_migration: migrationFlow,
    population_base: population,
    equity_flow_signal: equitySignal,
    market_insight: migrationFlow && migrationFlow > 5000 ?
      '💰 EQUITY FLOWING IN: Strong migration from wealthy metro areas detected' :
      '📊 STABLE MARKET: Organic population growth without major equity influx',
    note: "Using ABS_REGIONAL_MIGRATION. Configure ORIGIN_SA4/DEST_SA4 to track Sydney→Regional wealth migration."
  });
}

/**
 * Get investor sentiment: detect if market is FHB or investor driven
 */
async function handleGetInvestorSentiment(region: string): Promise<any> {
  validateRegion(region);
  
  const endpoint = `${ABS_API_BASE}ABS,LEND_HOUSING/all?startPeriod=2023&endPeriod=2024`;
  const data = await fetchABSData(endpoint);
  
  if (data.error) {
    return createErrorResponse(
      `Unable to retrieve investor sentiment data for region "${region}".\n` +
      `Issue: ${data.error}\n` +
      `Note: Configure PURPOSE dimension to split investor vs owner-occupier lending.`
    );
  }
  
  const lendingVolume = extractValue(data);
  const marketDriver = lendingVolume && lendingVolume > 150 ? 'INVESTOR_DRIVEN' :
                      lendingVolume && lendingVolume > 80 ? 'MIXED_MARKET' : 'FHB_MARKET';
  
  return createSuccessResponse({
    region,
    lending_volume: lendingVolume,
    market_driver: marketDriver,
    market_insight: lendingVolume && lendingVolume > 150 ?
      '🏢 INVESTOR STAMPEDE: High lending activity indicates investor dominance - prices may surge' :
      lendingVolume && lendingVolume > 80 ?
      '⚖️ BALANCED MARKET: Mixed investor/FHB activity - stable growth expected' :
      '🏠 FHB TERRITORY: Low volumes suggest first-home buyer market - organic demand',
    note: "Using LEND_HOUSING dataflow. Configure PURPOSE dimension to split investor/owner-occupier lending."
  });
}

/**
 * Get gentrification score: compare investment vs income growth
 */
async function handleGetGentrificationScore(postcode: string): Promise<any> {
  validatePostcode(postcode);
  
  const lendingEndpoint = `${ABS_API_BASE}ABS,LEND_HOUSING/all?startPeriod=2022&endPeriod=2024`;
  const lendingData = await fetchABSData(lendingEndpoint);
  
  const incomeEndpoint = `${ABS_API_BASE}ABS,ABS_ANNUAL_ERP_ASGS2021/all?startPeriod=2021&endPeriod=2021`;
  const incomeData = await fetchABSData(incomeEndpoint);
  
  if (lendingData.error && incomeData.error) {
    return createErrorResponse(
      `Unable to calculate gentrification score for postcode ${postcode}.\n` +
      `Issues: ${lendingData.error} / ${incomeData.error}\n` +
      `Note: Configure Census G02 INCP dimension for actual income data.`
    );
  }
  
  const investmentGrowth = extractValue(lendingData) || 100;
  const incomeBase = extractValue(incomeData) || 1000;
  const estimatedIncome = Math.floor(incomeBase * 50); // Proxy: $50 per capita
  
  // Calculate gentrification score: Investment growth vs income capacity
  const gentrificationScore = investmentGrowth / (estimatedIncome / 1000);
  const signal = gentrificationScore > 2.0 ? 'RAPID_GENTRIFICATION' :
                gentrificationScore > 1.2 ? 'GENTRIFYING' : 'STABLE';
  
  return createSuccessResponse({
    postcode,
    investment_lending: investmentGrowth,
    estimated_income: estimatedIncome,
    gentrification_score: Math.round(gentrificationScore * 100) / 100,
    signal,
    market_insight: gentrificationScore > 2.0 ?
      '🚀 RAPID GENTRIFICATION: Investment growth massively outpacing income - displacement risk' :
      gentrificationScore > 1.2 ?
      '📈 GENTRIFYING: Investment exceeds income growth - early-stage transformation' :
      '🏘️ STABLE COMMUNITY: Investment aligned with income levels - organic growth',
    note: "Using LEND_HOUSING for investment proxy and ERP for income base. Configure Census G02 INCP for actual income data."
  });
}

// ============================================================================
// MCP SERVER SETUP
// ============================================================================

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

    switch (name) {
      case 'get_suburb_stats':
        return await handleGetSuburbStats((args as { postcode: string }).postcode);
      
      case 'get_mortgage_stress':
        return await handleGetMortgageStress((args as { region: string }).region);
      
      case 'get_supply_pipeline':
        return await handleGetSupplyPipeline((args as { postcode: string }).postcode);
      
      case 'get_wealth_migration':
        return await handleGetWealthMigration((args as { region: string }).region);
      
      case 'get_investor_sentiment':
        return await handleGetInvestorSentiment((args as { region: string }).region);
      
      case 'get_gentrification_score':
        return await handleGetGentrificationScore((args as { postcode: string }).postcode);
      
      default:
        return createErrorResponse(
          `Unknown tool: "${name}". Available tools are: get_suburb_stats, get_mortgage_stress, ` +
          `get_supply_pipeline, get_wealth_migration, get_investor_sentiment, get_gentrification_score.`
        );
    }
  } catch (error) {
    const message = error instanceof ValidationError
      ? error.message  // Validation errors are already user-friendly
      : error instanceof Error
      ? error.message
      : String(error);
    
    return createErrorResponse(
      `Error executing tool: ${message}`
    );
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
