import pricing from '../../../config/pricing.json';

export function assertPricingSafety() {
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

  if (storageMargin < minS) {
    throw new Error(`FATAL: Storage margin ${storageMargin} < ${minS}`);
  }
  if (egressMargin < minE) {
    throw new Error(`FATAL: Egress margin ${egressMargin} < ${minE}`);
  }
  console.log('✅ Pricing safety asserted successfully');
  return { storageMargin, egressMargin };
}
