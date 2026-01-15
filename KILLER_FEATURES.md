# 🚀 Killer Features - Market Intelligence

This ABS MCP server now includes 4 "killer features" that provide actionable market intelligence beyond basic statistics.

## 1. 🏗️ Supply Pipeline Analysis (`get_supply_pipeline`)

**What it detects:** Supply flood risk or buy signals from building approvals

**Signals:**
- `FLOOD_RISK` - High dwelling approvals (>100k) indicate potential oversupply
- `BUY_SIGNAL` - Low approvals (<50k) suggest tight market conditions
- `NEUTRAL` - Balanced supply

**Market Insight:**
- ⚠️ HIGH SUPPLY COMING: Suburb may be flooded with new units - oversupply risk
- ✅ SUPPLY DEAD: Low approvals indicate tight market - potential buy signal

**Data Source:** `ABS,BUILDING_ACTIVITY/all`

## 2. 💰 Wealth Migration Tracking (`get_wealth_migration`)

**What it detects:** Equity flow from wealthy Sydney suburbs to regional areas

**Signals:**
- `WEALTH_INFLUX` - High migration (>5000) indicates capital flowing in
- `STABLE` - Normal population movement without major equity shift

**Market Insight:**
- 💰 EQUITY FLOWING IN: Strong migration from wealthy metro areas detected
- 📊 STABLE MARKET: Organic population growth without major equity influx

**Data Source:** `ABS,ABS_REGIONAL_MIGRATION/all`

## 3. 🏢 Investor Sentiment (`get_investor_sentiment`)

**What it detects:** Whether market is driven by investors or first home buyers (FHB)

**Signals:**
- `INVESTOR_DRIVEN` - High lending volume (>150) suggests investor dominance
- `MIXED_MARKET` - Moderate activity (80-150) indicates balanced market
- `FHB_MARKET` - Low volume (<80) suggests first home buyer territory

**Market Insight:**
- 🏢 INVESTOR STAMPEDE: High lending activity indicates investor dominance - prices may surge
- ⚖️ BALANCED MARKET: Mixed investor/FHB activity - stable growth expected
- 🏠 FHB TERRITORY: Low volumes suggest first-home buyer market - organic demand

**Data Source:** `ABS,LEND_HOUSING/all`

## 4. 📈 Gentrification Score (`get_gentrification_score`)

**What it detects:** Rapid gentrification by comparing investment growth vs employee income growth

**Calculation:** `investment_lending / (estimated_income / 1000)`

**Signals:**
- `RAPID_GENTRIFICATION` - Score >2.0 indicates investment massively outpacing income
- `GENTRIFYING` - Score >1.2 shows early-stage transformation
- `STABLE` - Score ≤1.2 suggests investment aligned with income levels

**Market Insight:**
- 🚀 RAPID GENTRIFICATION: Investment growth massively outpacing income - displacement risk
- 📈 GENTRIFYING: Investment exceeds income growth - early-stage transformation
- 🏘️ STABLE COMMUNITY: Investment aligned with income levels - organic growth

**Data Sources:** 
- Investment: `ABS,LEND_HOUSING/all`
- Income: `ABS,ABS_ANNUAL_ERP_ASGS2021/all` (proxy)

## Configuration Notes

All features include notes on how to configure SDMX dimensions for postcode-level precision:

- **REGION/SA2** dimensions for postcode filtering
- **PURPOSE** dimension to split investor vs owner-occupier lending
- **ORIGIN_SA4/DEST_SA4** to track Sydney→Regional migration flows
- **Census G02 INCP** for actual income data (currently using population proxy)

## Test Results

All 8 tests passing ✅

```bash
npm run build && node test-all-tools.js
```

## Example Outputs

### Supply Pipeline (Postcode 2000)
```json
{
  "postcode": "2000",
  "dwelling_approvals": 49493,
  "supply_signal": "BUY_SIGNAL",
  "market_insight": "✅ SUPPLY DEAD: Low approvals indicate tight market - potential buy signal"
}
```

### Investor Sentiment (Sydney)
```json
{
  "region": "Sydney",
  "lending_volume": 120,
  "market_driver": "MIXED_MARKET",
  "market_insight": "⚖️ BALANCED MARKET: Mixed investor/FHB activity - stable growth expected"
}
```

### Gentrification Score (Postcode 3000)
```json
{
  "postcode": "3000",
  "investment_lending": 215,
  "estimated_income": 150000,
  "gentrification_score": 1.43,
  "signal": "GENTRIFYING",
  "market_insight": "📈 GENTRIFYING: Investment exceeds income growth - early-stage transformation"
}
```
