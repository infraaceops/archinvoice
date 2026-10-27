const fs = require('fs');
const path = require('path');

const pricingPath = path.resolve(__dirname, '../config/pricing.json');
const pricing = JSON.parse(fs.readFileSync(pricingPath, 'utf-8'));

function runGuard() {
  const fx = pricing.fx_usd_to_pkr;
  const costStoragePkr = pricing.costBasisUsd.storagePerGb * fx;
  const costEgressPkr = pricing.costBasisUsd.egressPerGb * fx;

  const storageMargin =
    (pricing.storage.pricePkrPerGbMonth - costStoragePkr) /
    pricing.storage.pricePkrPerGbMonth;
  const egressMargin =
    (pricing.egress.pricePkrPerGb - costEgressPkr) /
    pricing.egress.pricePkrPerGb;

  const minS = pricing.guardrails.minStorageMarginPct / 100;
  const minE = pricing.guardrails.minEgressMarginPct / 100;

  console.log(`[Pricing Guard] Storage Margin: ${(storageMargin * 100).toFixed(2)}% (Min required: ${pricing.guardrails.minStorageMarginPct}%)`);
  console.log(`[Pricing Guard] Egress Margin: ${(egressMargin * 100).toFixed(2)}% (Min required: ${pricing.guardrails.minEgressMarginPct}%)`);

  if (storageMargin < minS) {
    console.error(`❌ FATAL: Storage margin ${storageMargin} < ${minS}`);
    process.exit(1);
  }
  if (egressMargin < minE) {
    console.error(`❌ FATAL: Egress margin ${egressMargin} < ${minE}`);
    process.exit(1);
  }

  console.log('✅ Pricing safety asserted: All margins pass safety thresholds.');
}

runGuard();
