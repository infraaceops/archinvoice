import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { TenantDoc } from '../types';
import pricing from '../../../config/pricing.json';

export const dailyMeteringCron = onSchedule('every 24 hours', async () => {
  const db = getFirestore();
  const tenantsSnap = await db.collection('tenants').get();
  const fx = pricing.fx_usd_to_pkr;
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  for (const doc of tenantsSnap.docs) {
    const tenant = doc.data() as TenantDoc;
    const tenantId = doc.id;

    const storageBytes = tenant.storage?.usedBytes || 0;
    const egressBytes = tenant.storage?.egressMonthBytes || 0;

    const storageGb = storageBytes / (1024 * 1024 * 1024);
    const egressGb = egressBytes / (1024 * 1024 * 1024);

    // Cost basis in PKR
    const storageCostPkr = storageGb * pricing.costBasisUsd.storagePerGb * fx;
    const egressCostPkr = egressGb * pricing.costBasisUsd.egressPerGb * fx;
    const functionCostPkr = (50 / 1000000) * pricing.costBasisUsd.functionPerMillion * fx;
    const firestoreCostPkr = (100 / 100000) * pricing.costBasisUsd.firestoreReadPer100k * fx;

    const computedCostPkr = Math.round((storageCostPkr + egressCostPkr + functionCostPkr + firestoreCostPkr) * 100) / 100;

    // Revenue in PKR
    const subRevenue = tenant.subscription?.status === 'active' ? (tenant.subscription?.pricePkr || 280) : 0;
    const packRevenue = (tenant.storage?.purchasedGb || 0) * (pricing.storage?.pricePkrPerGbMonth || 100);
    const revenuePkr = subRevenue + packRevenue;

    const marginPkr = Math.round((revenuePkr - computedCostPkr) * 100) / 100;
    const isNegativeMargin = marginPkr < 0;

    const billingRef = db.doc(`tenants/${tenantId}/billing/${monthKey}`);
    await billingRef.set({
      storageGb,
      egressGb,
      functionCalls: 50,
      firestoreReads: 100,
      computedCostPkr,
      revenuePkr,
      marginPkr,
      throttled: isNegativeMargin,
      updatedAt: Timestamp.now(),
    }, { merge: true });

    if (isNegativeMargin) {
      await doc.ref.update({
        'storage.throttled': true,
      });
    }
  }

  console.log(`[Daily Metering] Processed ${tenantsSnap.size} tenants for ${monthKey}`);
});

export const gracePeriodEnforcer = onSchedule('every 1 hours', async () => {
  const db = getFirestore();
  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

  const graceTenantsSnap = await db
    .collection('tenants')
    .where('subscription.status', '==', 'grace')
    .get();

  for (const doc of graceTenantsSnap.docs) {
    const tenant = doc.data() as TenantDoc;
    const periodEnd = tenant.subscription?.currentPeriodEnd?.toDate?.() || new Date(0);

    if (periodEnd < threeDaysAgo) {
      console.log(`[Grace Enforcer] Locking tenant ${doc.id} - grace period expired.`);
      await doc.ref.update({
        'subscription.status': 'locked',
      });
    }
  }
});
