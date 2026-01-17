# Integration Tests

This directory contains integration tests and verification scripts for the ABS MCP Server.

## Running Tests

### Quick Geospatial Tests
```bash
node test-geospatial.js
```

### Full Tool Testing
```bash
node test-all-tools.js
```

### E2E Summary Test
```bash
node test-e2e-summary.js
```

### Gemini CLI Integration Test
```bash
node GEMINI_INTEGRATION.js
```

## Test Files

- **test-geospatial.js**: Tests reverse geocoding (lat/lon → SA2 → postcode)
- **test-all-tools.js**: Comprehensive tool testing
- **test-e2e-summary.js**: End-to-end verification with summary output
- **GEMINI_INTEGRATION.js**: Tests integration with Gemini CLI
- **test-gemini-quick.sh**: Quick Gemini CLI smoke test
- **CATALOG_SUBMISSION.md**: Documentation for MCP catalog submission
- **VERIFICATION_REPORT.md**: Detailed verification of data accuracy

## Data Files

Generated data files for testing are stored here during test execution:
- erp_data.json
- income_data.json
- c21_g02_poa_structure.json
