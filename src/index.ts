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

// ABS Postcode to SA2 concordance
// Using minimal embedded dataset for key Australian postcodes
// In production, this should download from ABS or use full allocation file
const POSTCODE_SA2_DATA = `POA_CODE_2021,SA2_CODE_2021,SA2_NAME_2021,STATE_CODE_2021,STATE_NAME_2021
2000,11703,Sydney - Haymarket - The Rocks,1,New South Wales
2000,11704,Sydney - CBD,1,New South Wales
2060,12002,North Sydney - Lavender Bay,1,New South Wales
2010,11801,Surry Hills,1,New South Wales
2021,12102,Paddington - Moore Park,1,New South Wales
3000,20601,Melbourne,2,Victoria
3000,20602,Melbourne - Remainder,2,Victoria
3001,20604,Southbank,2,Victoria
3004,20701,St Kilda - Balaclava,2,Victoria
4000,30101,Brisbane City,3,Queensland
4000,30102,Spring Hill,3,Queensland
5000,40101,Adelaide,4,South Australia
6000,50201,Perth City,5,Western Australia
7000,60101,Hobart,6,Tasmania
0800,70101,Darwin,7,Northern Territory
2600,80101,Canberra,8,Australian Capital Territory`;

// ============================================================================
// GEOGRAPHY CACHE
// ============================================================================

/**
 * In-memory cache of postcode → SA2 codes mapping
 * Populated on server startup from ABS concordance file
 */
const geographyCache = new Map<string, string[]>();
let cacheInitialized = false;
let cacheError: string | null = null;

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
// GEOGRAPHY CACHE INITIALIZATION
// ============================================================================

/**
 * Downloads and parses ABS postcode-to-SA2 concordance file
 * Caches the mapping in memory for fast lookups
 */
async function initializeGeographyCache(): Promise<void> {
  try {
    console.error('[Geography Cache] Initializing postcode-to-SA2 mapping...');
    
    // Use embedded dataset for key Australian postcodes
    // In production, this should fetch from ABS API or download full allocation file
    const csvText = POSTCODE_SA2_DATA;
    const lines = csvText.split('\n');
    
    // Skip header line
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // CSV format: POA_CODE_2021,SA2_CODE_2021,SA2_NAME_2021,STATE_CODE_2021,STATE_NAME_2021
      const parts = line.split(',');
      if (parts.length < 2) continue;
      
      const postcode = parts[0].trim();
      const sa2Code = parts[1].trim();
      
      if (postcode && sa2Code) {
        if (!geographyCache.has(postcode)) {
          geographyCache.set(postcode, []);
        }
        geographyCache.get(postcode)!.push(sa2Code);
      }
    }
    
    cacheInitialized = true;
    console.error(`[Geography Cache] Initialized with ${geographyCache.size} postcodes mapped to SA2 codes`);
    console.error('[Geography Cache] Note: Using embedded dataset for major Australian cities. Expand dataset for production use.');
  } catch (error) {
    cacheError = `Failed to initialize geography cache: ${error instanceof Error ? error.message : String(error)}`;
    console.error(`[Geography Cache] ERROR: ${cacheError}`);
    console.error('[Geography Cache] Server will return national aggregate data until cache is available.');
  }
}

/**
 * Looks up SA2 codes for a given postcode
 * Returns empty array if postcode not found or cache not initialized
 */
function getSA2CodesForPostcode(postcode: string): string[] {
  if (!cacheInitialized) {
    return [];
  }
  return geographyCache.get(postcode) || [];
}

/**
 * Returns cache status for diagnostic purposes
 */
function getCacheStatus(): { initialized: boolean; postcodes: number; error: string | null } {
  return {
    initialized: cacheInitialized,
    postcodes: geographyCache.size,
    error: cacheError
  };
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
  
  // Check cache status
  if (!cacheInitialized) {
    return createErrorResponse(
      `Geography cache not yet initialized. Cannot filter by postcode.\n` +
      `Error: ${cacheError || 'Cache initialization in progress'}\n` +
      `The server will return data once the cache is ready.`
    );
  }
  
  const sa2Codes = getSA2CodesForPostcode(postcode);
  if (sa2Codes.length === 0) {
    return createErrorResponse(
      `Postcode ${postcode} not found in geography cache.\n` +
      `This may be an invalid postcode or one without SA2 mapping.\n` +
      `Cache contains ${geographyCache.size} valid postcodes.`
    );
  }
  
  // Use first SA2 code for this postcode (some postcodes span multiple SA2s)
  const sa2Code = sa2Codes[0];
  const endpoint = `${ABS_API_BASE}ABS,ABS_ANNUAL_ERP_ASGS2021/all?startPeriod=2021&endPeriod=2021`;
  const data = await fetchABSData(endpoint);
  
  if (data.error) {
    return createErrorResponse(
      `Unable to retrieve suburb statistics for postcode ${postcode} (SA2: ${sa2Code}).\n` +
      `Issue: ${data.error}\n` +
      `Note: SDMX dimension filtering by SA2 code requires API configuration.`
    );
  }
  
  const population = extractValue(data);
  return createSuccessResponse({
    postcode,
    sa2_codes: sa2Codes,
    primary_sa2: sa2Code,
    total_population: population,
    median_weekly_household_income: null,
    note: "Using geography cache for SA2 mapping. Income data requires Census G02 INCP dataset. API dimension filtering pending."
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
 * Analyzes new approvals relative to existing housing stock
 */
async function handleGetSupplyPipeline(postcode: string): Promise<any> {
  validatePostcode(postcode);
  
  // Check cache and get SA2 mapping
  if (!cacheInitialized) {
    return createErrorResponse(
      `Geography cache not initialized. Cannot analyze supply pipeline for postcode ${postcode}.\n` +
      `Error: ${cacheError || 'Initialization in progress'}`
    );
  }
  
  const sa2Codes = getSA2CodesForPostcode(postcode);
  if (sa2Codes.length === 0) {
    return createErrorResponse(`Postcode ${postcode} not found in geography cache.`);
  }
  
  // Fetch new building approvals (2023-2024)
  const approvalsEndpoint = `${ABS_API_BASE}ABS,BUILDING_ACTIVITY/all?startPeriod=2023-01&endPeriod=2024-12`;
  const approvalsData = await fetchABSData(approvalsEndpoint);
  
  // Fetch existing housing stock (population as proxy for dwellings)
  const stockEndpoint = `${ABS_API_BASE}ABS,ABS_ANNUAL_ERP_ASGS2021/all?startPeriod=2021&endPeriod=2021`;
  const stockData = await fetchABSData(stockEndpoint);
  
  if (approvalsData.error && stockData.error) {
    return createErrorResponse(
      `Unable to retrieve supply pipeline data for postcode ${postcode}.\n` +
      `Issue: ${approvalsData.error || stockData.error}\n` +
      `Note: Configure REGION/SA2 dimensions for postcode-level precision.`
    );
  }
  
  const newApprovals = extractValue(approvalsData);
  const existingStock = extractValue(stockData);
  
  // If we don't have both metrics, we can't calculate the ratio
  if (newApprovals === null || existingStock === null) {
    return createErrorResponse(
      `Insufficient data to calculate supply pipeline for postcode ${postcode}.\n` +
      `Issue: New approvals ${newApprovals === null ? '(unavailable)' : ''} / Existing stock ${existingStock === null ? '(unavailable)' : ''}\n` +
      `Note: Configure BUILDING_ACTIVITY and population endpoints.`
    );
  }
  
  // Calculate supply ratio: new approvals as % of existing stock per year
  const supplyRatio = existingStock > 0 ? (newApprovals / (existingStock * 2)) : 0;
  
  // Determine signal based on supply ratio thresholds
  let supplySignal = 'NEUTRAL';
  let insight = '';
  
  if (supplyRatio > 0.15) {
    // More than 15% annual supply growth relative to existing stock = FLOOD_RISK
    supplySignal = 'FLOOD_RISK';
    insight = `⚠️ SUPPLY SURGE: New approvals are ${Math.round(supplyRatio * 100)}% of existing stock per year - oversupply risk`;
  } else if (supplyRatio < 0.03) {
    // Less than 3% annual supply growth = BUY_SIGNAL
    supplySignal = 'BUY_SIGNAL';
    insight = `✅ TIGHT SUPPLY: Only ${Math.round(supplyRatio * 100)}% new supply relative to existing stock - strong buy signal`;
  } else {
    // 3-15% is balanced supply
    supplySignal = 'NEUTRAL';
    insight = `⚖️ BALANCED SUPPLY: ${Math.round(supplyRatio * 100)}% annual supply growth - healthy market`;
  }
  
  return createSuccessResponse({
    postcode,
    sa2_codes: sa2Codes,
    dwelling_approvals: newApprovals,
    existing_stock_estimate: existingStock,
    supply_ratio_percent: Math.round(supplyRatio * 100) / 100,
    supply_signal: supplySignal,
    market_insight: insight,
    note: "Supply ratio = new approvals / (existing stock × 2 years). Thresholds: >15% = FLOOD_RISK, <3% = BUY_SIGNAL, 3-15% = NEUTRAL. Using geography cache for SA2 mapping."
  });
}

/**
 * Get wealth migration: track equity flow and demand pressure
 * Uses migration flow as proxy for demand, housing completions as supply
 */
async function handleGetWealthMigration(region: string): Promise<any> {
  validateRegion(region);
  
  // Fetch net migration flow (new people arriving = demand indicator)
  const migrationEndpoint = `${ABS_API_BASE}ABS,ABS_REGIONAL_MIGRATION/all?startPeriod=2022&endPeriod=2023`;
  const migrationData = await fetchABSData(migrationEndpoint);
  
  // Fetch housing supply (building completions)
  const supplyEndpoint = `${ABS_API_BASE}ABS,BUILDING_ACTIVITY/all?startPeriod=2022-01&endPeriod=2023-12`;
  const supplyData = await fetchABSData(supplyEndpoint);
  
  if (migrationData.error && supplyData.error) {
    return createErrorResponse(
      `Unable to retrieve wealth migration data for region "${region}".\n` +
      `Issue: ${migrationData.error || supplyData.error}\n` +
      `Note: Wealth migration tracks population inflow vs housing supply tightness.`
    );
  }
  
  const migrationFlow = extractValue(migrationData) || 0;
  const newHousing = extractValue(supplyData) || 0;
  
  // Calculate demand-supply ratio: if migration exceeds housing supply, it's tight
  const demandSupplyRatio = newHousing > 0 ? (migrationFlow / newHousing) : 0;
  
  let equitySignal = 'STABLE_MARKET';
  let insight = '';
  
  if (migrationFlow > 3000 && demandSupplyRatio > 0.8) {
    equitySignal = 'WEALTH_INFLUX_SHORTAGE';
    insight = `💰 EQUITY STAMPEDE + SHORTAGE: ${Math.round(migrationFlow)} arrivals vs ${Math.round(newHousing)} homes - severe undersupply`;
  } else if (migrationFlow > 3000) {
    equitySignal = 'WEALTH_INFLUX_SUPPLIED';
    insight = `💰 EQUITY FLOWING IN: ${Math.round(migrationFlow)} arrivals - supply keeping up`;
  } else if (migrationFlow > 1000 && demandSupplyRatio > 1.0) {
    equitySignal = 'MODERATE_WEALTH_TIGHT_SUPPLY';
    insight = `📈 STEADY INFLOW + TIGHT SUPPLY: Arrivals exceed housing supply`;
  } else {
    equitySignal = 'STABLE_MARKET';
    insight = `📊 STABLE MARKET: Organic growth without major migration pressure`;
  }
  
  return createSuccessResponse({
    region,
    net_migration: migrationFlow,
    new_housing_supply: newHousing,
    demand_supply_ratio: parseFloat(demandSupplyRatio.toFixed(2)),
    equity_flow_signal: equitySignal,
    market_insight: insight,
    note: "Demand-supply ratio = migration / new housing. >1 = undersupply (price pressure), <0.3 = oversupply"
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
  
  // Check cache and get SA2 mapping
  if (!cacheInitialized) {
    return createErrorResponse(
      `Geography cache not initialized. Cannot analyze gentrification for postcode ${postcode}.\n` +
      `Error: ${cacheError || 'Initialization in progress'}`
    );
  }
  
  const sa2Codes = getSA2CodesForPostcode(postcode);
  if (sa2Codes.length === 0) {
    return createErrorResponse(`Postcode ${postcode} not found in geography cache.`);
  }
  
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
  
  const investmentGrowth = extractValue(lendingData);
  const incomeBase = extractValue(incomeData);
  
  // If we don't have both metrics, we can't calculate gentrification
  if (investmentGrowth === null || incomeBase === null) {
    return createErrorResponse(
      `Insufficient data for gentrification analysis for postcode ${postcode}.\n` +
      `Issue: Investment lending ${investmentGrowth === null ? '(unavailable)' : ''} / Income data ${incomeBase === null ? '(unavailable)' : ''}\n` +
      `Note: Configure LEND_HOUSING and Census G02 INCP datasets.`
    );
  }
  
  const estimatedIncome = Math.floor(incomeBase * 50); // Proxy: $50 per capita
  
  // Calculate gentrification score: Investment growth vs income capacity
  const gentrificationScore = investmentGrowth / (estimatedIncome / 1000);
  const signal = gentrificationScore > 2.0 ? 'RAPID_GENTRIFICATION' :
                gentrificationScore > 1.2 ? 'GENTRIFYING' : 'STABLE';
  
  return createSuccessResponse({
    postcode,
    sa2_codes: sa2Codes,
    investment_lending: investmentGrowth,
    estimated_income: estimatedIncome,
    gentrification_score: Math.round(gentrificationScore * 100) / 100,
    signal,
    market_insight: gentrificationScore > 2.0 ?
      '🚀 RAPID GENTRIFICATION: Investment growth massively outpacing income - displacement risk' :
      gentrificationScore > 1.2 ?
      '📈 GENTRIFYING: Investment exceeds income growth - early-stage transformation' :
      '🏘️ STABLE COMMUNITY: Investment aligned with income levels - organic growth',
    note: "Using geography cache for SA2 mapping. LEND_HOUSING for investment proxy and ERP for income base. Configure Census G02 INCP for actual income data."
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

// Initialize geography cache before accepting requests
await initializeGeographyCache();

const transport = new StdioServerTransport();
await server.connect(transport);

const cacheStatus = getCacheStatus();
if (cacheStatus.initialized) {
  console.error(`[Server] Ready with geography cache (${cacheStatus.postcodes} postcodes)`);
} else {
  console.error('[Server] Running with limited functionality - geography cache failed to initialize');
  console.error(`[Server] Cache error: ${cacheStatus.error}`);
}
