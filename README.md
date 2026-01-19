# ABS MCP Server

A Model Context Protocol (MCP) server for accessing Australian Bureau of Statistics (ABS) socio-economic data. Query suburb statistics and mortgage stress indicators for Australian postcodes through natural language with any MCP-compatible client.

**Compatible with:**
- 🔧 **Gemini CLI** - Google's command-line interface for AI models
- 🔌 **Claude Desktop** - Anthropic's Claude with MCP support
- 💻 **VS Code** - IDEs with MCP integration
- 🤖 **LLM integrations** - Any tool supporting the Model Context Protocol
- 🐳 **Docker MCP** - Automatic discovery via Docker containers

## Overview

**abs-mcp-server** provides seven tools for Australian socio-economic analysis:

**Core Demographics:**
1. **get_location_stats** - Get suburb statistics by latitude/longitude coordinates (finds nearest SA2 region - more precise than postcodes)
2. **get_suburb_stats** - Get median weekly household income and population for an Australian postcode
3. **get_mortgage_stress** - Get household debt/mortgage-to-income ratios for a region

**Real Estate Market Analysis:**
4. **get_supply_pipeline** - Analyze building approvals vs existing stock (supply flood risk or buy signals)
5. **get_wealth_migration** - Analyze migration inflow vs housing supply (demand/supply dynamics)
6. **get_investor_sentiment** - Analyze lending patterns (investor-driven vs first-home buyer markets)
7. **get_gentrification_score** - Compare investment growth vs income levels (gentrification indicators)

### Geography Cache System

The server implements an intelligent geography cache that:
- **Loads on startup** - SA2 and postcode mappings initialized with coordinates before accepting requests
- **SA2 location data** - Each SA2 region stored with latitude/longitude coordinates for precise location lookups
- **Validates postcodes** - Ensures postcode exists in the cache before making API calls
- **Maps to ABS geography** - Translates postcodes to Statistical Area Level 2 (SA2) codes
- **Fast lookups** - In-memory cache provides instant postcode and lat/long-based lookups using Haversine distance calculation

**Current Coverage**: 16 SA2 regions across 13 major Australian postcodes (capital cities: Sydney, Melbourne, Brisbane, Adelaide, Perth, Hobart, Darwin, Canberra)

**Lat/Long Lookup**: The `get_location_stats` tool finds the nearest SA2 region to any coordinate within Australia, providing more precise results than postcode-based lookups.

**For Production**: Expand the embedded dataset in `src/index.ts` to include all ~2,200 SA2 regions and ~3,000 Australian postcodes, or implement dynamic download from ABS allocation files.

The server runs in Docker and is discoverable via Docker MCP, making it seamlessly available to Gemini CLI and other MCP clients.

---

## Quick Start

### Prerequisites
- Docker & Docker Desktop (with MCP support enabled)
- Node.js 20+ (for local development)
- Gemini CLI (`npm install -g @google/gemini-cli`)

### 1. Build and Run the Docker Container

```bash
# Build the Docker image
docker build -t abs-mcp-server:latest .

# Run the container
docker run -d --name abs-mcp-server abs-mcp-server:latest
```

### 2. Verify Server is Running

```bash
docker logs abs-mcp-server
```

The server should output that it's connected via StdioServerTransport.

### 3. Use with Gemini CLI

```bash
# Query suburb statistics
gemini "What are the suburb statistics for Sydney postcode 2000?" \
  --allowed-mcp-server-names abs-mcp-server

# Query mortgage stress
gemini "Get mortgage stress data for postcode 3000" \
  --allowed-mcp-server-names abs-mcp-server
```

---

## Setup for Docker MCP Discovery

### Enable Docker MCP in Docker Desktop

Docker Desktop automatically discovers MCP servers running in containers. The abs-mcp-server container is automatically registered when running.

### Verify Discovery

```bash
# List available MCP servers
gemini "List all available MCP tools" --allowed-mcp-server-names abs-mcp-server
```

You should see:
- `get_location_stats` (latitude: number, longitude: number)
- `get_suburb_stats` (postcode: string)
- `get_mortgage_stress` (region: string)
- `get_supply_pipeline` (postcode: string)
- `get_wealth_migration` (region: string)
- `get_investor_sentiment` (region: string)
- `get_gentrification_score` (postcode: string)

---

## Available Tools

### get_location_stats

Get suburb statistics for a location specified by latitude and longitude coordinates. Uses the geography cache to find the nearest SA2 (Statistical Area Level 2) region, which provides more granular and precise location data than postcodes.

**Input:**
```json
{
  "latitude": -33.8688,   // Latitude coordinate (-90 to 90)
  "longitude": 151.2093   // Longitude coordinate (-180 to 180)
}
```

**Example Usage:**
```bash
gemini "Get statistics for location at latitude -33.8688, longitude 151.2093" --allowed-mcp-server-names abs-mcp-server
```

**Output includes:**
- Nearest SA2 region code and name (e.g., "Sydney - Haymarket - The Rocks")
- Distance from query location in kilometers
- Associated postcode and state
- Population data
- Median household income (when available)

**Why SA2 regions?** SA2 regions are smaller geographical areas than postcodes (typically 3,000-25,000 people), providing more accurate location-based statistics. A single postcode might contain multiple SA2 regions, each with different demographics.

---

### get_suburb_stats

Get median weekly household income and total population for a given Australian postcode.

**Input:**
```json
{
  "postcode": "2000"  // 4-digit Australian postcode
}
```

**Example Usage:**
```bash
gemini "Get suburb statistics for postcode 2000" --allowed-mcp-server-names abs-mcp-server
```

### get_mortgage_stress

Get household debt or mortgage-to-income ratios for a given region.

**Input:**
```json
{
  "region": "Sydney"  // Postcode or area code/name
}
```

**Example Usage:**
```bash
gemini "What's the mortgage stress for Melbourne?" --allowed-mcp-server-names abs-mcp-server
```

---

## Real Estate Market Analysis Tools

### get_supply_pipeline

Get building approvals data for a postcode to understand construction activity.

**Input:**
```json
{
  "postcode": "2000"  // 4-digit Australian postcode
}
```

**Use Case:** Are they building too much or too little here?

**Example Usage:**
```bash
gemini "What's the supply pipeline for Sydney 2000?" --allowed-mcp-server-names abs-mcp-server
```

---

### get_migration_flow

Get internal migration data for a region to assess population growth from interstate moves.

**Input:**
```json
{
  "region": "Sydney"  // Region name or identifier
}
```

**Use Case:** Is the population actually growing from interstate moves?

**Example Usage:**
```bash
gemini "What's the migration flow into Melbourne?" --allowed-mcp-server-names abs-mcp-server
```

---

### get_buyer_profile

Get lending indicators for a region to understand buyer composition.

**Input:**
```json
{
  "region": "Sydney"  // Region name or identifier
}
```

**Use Case:** Is this market being driven by moms and dads or big investors?

**Example Usage:**
```bash
gemini "What are the lending indicators for Brisbane?" --allowed-mcp-server-names abs-mcp-server
```

---

### get_wealth_score

Get personal income distribution data for a postcode to track wealth trends.

**Input:**
```json
{
  "postcode": "3000"  // 4-digit Australian postcode
}
```

**Use Case:** Is the income bracket of this suburb shifting upward?

**Example Usage:**
```bash
gemini "What's the wealth score for postcode 3000?" --allowed-mcp-server-names abs-mcp-server
```

---

## Local Development

### Install Dependencies

```bash
npm install
```

### Build TypeScript

```bash
npm run build
```

### Run Locally

```bash
npm start
```

Or in development mode with auto-reload:

```bash
npm run dev
```

### Run Tests

```bash
npm test
```

---

## Architecture

- **Framework**: @modelcontextprotocol/sdk
- **Language**: TypeScript (ES2022)
- **Runtime**: Node.js 20 (slim Docker image)
- **Transport**: StdioServerTransport (for MCP communication)
- **Validation**: JSON Schema (via Zod patterns)
- **License**: GPL-3.0

### File Structure

```
abs-mcp-server/
├── src/
│   └── index.ts              # MCP server implementation
├── dist/                     # Compiled JavaScript (generated)
├── Dockerfile                # Docker container configuration
├── package.json              # Dependencies and scripts
├── tsconfig.json             # TypeScript configuration
├── jest.config.js            # Test configuration
├── test-server.js            # Integration test script
└── README.md                 # This file
```

---

## API Data Sources

The server uses the **ABS Data API** with SDMX (Statistical Data and Metadata Exchange) format following the pattern:

`https://data.api.abs.gov.au/rest/data/{dataflowIdentifier}/{dataKey}`

**API Documentation**: [OpenAPI Spec](https://raw.githubusercontent.com/apigovau/api-descriptions/master/abs/DataAPI.openapi.yaml)

**Available Dataflows** (examples used in tools):
- `BUILDING_ACTIVITY` - Building approvals and construction data  
- `ABS_REGIONAL_MIGRATION` - Interstate and regional migration flows
- `LEND_HOUSING` - Housing finance and lending indicators
- Census dataflows - Income and population statistics by geography

**Current Implementation Status**:

All 6 tools are fully implemented with:
- ✅ Proper MCP protocol support (tool discovery and execution)
- ✅ SDMX-JSON parsing with error handling
- ✅ Input validation (postcode format, region strings)
- ⚠️  Placeholder dataflow queries (return 400 - need dimension configuration)

**Next Steps for Production Use**:

To make tools return real data, configure each tool with:
1. Correct dataflow identifier (e.g., `ABS,BUILDING_ACTIVITY,1.0.0`)
2. Dimensional filters (dataKey) to match postcode/region to SDMX dimensions
3. Time period filters (`startPeriod`, `endPeriod`)

Example working query structure:
```
https://data.api.abs.gov.au/rest/data/ABS,BUILDING_ACTIVITY/all?startPeriod=2023
```

All tool implementations follow this pattern and are ready for dimension mapping.

---

## Docker Deployment

### Build

```bash
docker build -t abs-mcp-server:latest .
```

### Run

```bash
docker run -d --name abs-mcp-server abs-mcp-server:latest
```

### View Logs

```bash
docker logs -f abs-mcp-server
```

### Stop Container

```bash
docker stop abs-mcp-server
docker rm abs-mcp-server
```

---

## Troubleshooting

### Server Not Discoverable in Gemini CLI

**Solution**: Ensure Docker Desktop MCP support is enabled and the container is running:
```bash
docker ps | grep abs-mcp-server
```

### Tool Execution Fails

Check the server logs for error details:
```bash
docker logs abs-mcp-server
```

### Postcode Not Found

Ensure you're using a valid 4-digit Australian postcode (e.g., 2000 for Sydney, 3000 for Melbourne).

---

## Example Queries

```bash
# Get statistics by latitude/longitude (Sydney CBD)
gemini "Get statistics for location at latitude -33.8688, longitude 151.2093" --allowed-mcp-server-names abs-mcp-server

# Get income and population for Sydney CBD by postcode
gemini "Get statistics for postcode 2000" --allowed-mcp-server-names abs-mcp-server

# Get mortgage stress data
gemini "What is the mortgage stress level for Melbourne?" --allowed-mcp-server-names abs-mcp-server

# Compare multiple postcodes
gemini "Compare postcode 2000 and 3000" --allowed-mcp-server-names abs-mcp-server

# Find suburb info from coordinates (Melbourne)
gemini "What suburb is at -37.8136, 144.9631?" --allowed-mcp-server-names abs-mcp-server
```

---

## License

GPL-3.0 - See LICENSE file for details
```bash
gemini mcp add abs-mcp-server node /Users/paulesson/projects/abs-mcp-server/dist/index.js
```

### Usage
```bash
gemini "Query your question" --allowed-mcp-server-names abs-mcp-server
```

---

## 📁 File Structure
```
abs-mcp-server/
├── src/
│   ├── index.ts                    # Main MCP server implementation
│   └── index.protocol.test.ts      # Protocol tests
├── dist/
│   └── index.js                    # Compiled JavaScript (built)
├── package.json                    # Dependencies & scripts
├── tsconfig.json                   # TypeScript configuration
├── Dockerfile                      # Container image definition
├── test-server.js                  # Integration test script
├── .gemini                         # Gemini CLI config
└── README.md                       # This file
```

---

## 🔧 Build & Run

### Build
```bash
npm run build
```

### Run MCP Server
```bash
npm start
```

### Run Tests
```bash
npm run test
```

### Run Integration Tests
```bash
node test-server.js
```

---

## 🐳 Docker Deployment

### Build Image
```bash
docker build -t abs-mcp-server:latest .
```

### Run Container
```bash
docker run -p 8080:8080 abs-mcp-server:latest
```

---

## 📝 Notes

- The MCP server uses stdio transport for communication with Gemini CLI
- Tools return JSON-formatted responses with error handling
- ABS API endpoints are configured for the Data Explorer API
- All code is licensed under GPL-3.0
- The server gracefully handles malformed SDMX-JSON responses

---

## ✨ Features

✅ Node.js/TypeScript implementation  
✅ Official @modelcontextprotocol/sdk usage  
✅ Zod validation (via JSON Schema)  
✅ SDMX-JSON error handling  
✅ GPL-3.0 licensing  
✅ Containerized with Docker  
✅ Gemini CLI integration  
✅ Comprehensive testing
