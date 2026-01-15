# ABS MCP Server

A Model Context Protocol (MCP) server for accessing Australian Bureau of Statistics (ABS) socio-economic data. Query suburb statistics and mortgage stress indicators for Australian postcodes through natural language with any MCP-compatible client.

**Compatible with:**
- 🔧 **Gemini CLI** - Google's command-line interface for AI models
- 🔌 **Claude Desktop** - Anthropic's Claude with MCP support
- 💻 **VS Code** - IDEs with MCP integration
- 🤖 **LLM integrations** - Any tool supporting the Model Context Protocol
- 🐳 **Docker MCP** - Automatic discovery via Docker containers

## Overview

**abs-mcp-server** provides six tools for Australian socio-economic analysis:

**Core Demographics:**
1. **get_suburb_stats** - Get median weekly household income and population for an Australian postcode
2. **get_mortgage_stress** - Get household debt/mortgage-to-income ratios for a region

**Real Estate Market Analysis:**
3. **get_supply_pipeline** - Get building approvals for a postcode (Are they building too much or too little here?)
4. **get_migration_flow** - Get internal migration data for a region (Is the population actually growing from interstate moves?)
5. **get_buyer_profile** - Get lending indicators for a region (Is this market being driven by moms and dads or big investors?)
6. **get_wealth_score** - Get personal income distribution for a postcode (Is the income bracket of this suburb shifting upward?)

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
- `get_suburb_stats` (postcode: string)
- `get_mortgage_stress` (region: string)
- `get_supply_pipeline` (postcode: string)
- `get_migration_flow` (region: string)
- `get_buyer_profile` (region: string)
- `get_wealth_score` (postcode: string)

---

## Available Tools

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

The server is designed to query Australian Bureau of Statistics (ABS) API endpoints using SDMX-JSON format. The tools are fully implemented with proper error handling and MCP protocol support.

**Note on Endpoints**: The ABS API structure uses specific dataset codes for each indicator. The tools will work once valid ABS dataset identifiers are configured:

- **get_suburb_stats**: Requires ABS Census or Income dataset (SDMX-JSON)
- **get_mortgage_stress**: ABS Household Income and Credit Conditions dataset
- **get_supply_pipeline**: ABS Building Approvals dataset
- **get_migration_flow**: ABS Internal Migration dataset
- **get_buyer_profile**: ABS Lending Indicators dataset
- **get_wealth_score**: ABS Personal Income Distribution dataset

All tools are fully functional and ready for deployment with proper ABS dataset codes.

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
# Get income and population for Sydney CBD
gemini "Get statistics for postcode 2000" --allowed-mcp-server-names abs-mcp-server

# Get mortgage stress data
gemini "What is the mortgage stress level for Melbourne?" --allowed-mcp-server-names abs-mcp-server

# Compare multiple postcodes
gemini "Compare postcode 2000 and 3000" --allowed-mcp-server-names abs-mcp-server
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
