import { onRequest } from 'firebase-functions/v2/https';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

export const playRTDNWebhook = onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const message = req.body?.message;
  if (!message || !message.data) {
    res.status(400).send('Bad Request: Missing Pub/Sub message data');
    return;
  }

  try {
    const rawData = Buffer.from(message.data, 'base64').toString('utf-8');
    const notification = JSON.parse(rawData);

    const db = getFirestore();

    // Check for subscription notification
    if (notification.subscriptionNotification) {
      const { notificationType, purchaseToken, subscriptionId } = notification.subscriptionNotification;

      // 1: RECOVERED, 2: RENEWED, 4: PURCHASED
      if ([1, 2, 4].includes(notificationType)) {
        const querySnap = await db
          .collection('tenants')
          .where('subscription.purchaseToken', '==', purchaseToken)
          .limit(1)
          .get();

        if (!querySnap.empty) {
          const tenantRef = querySnap.docs[0].ref;
          const nextMonth = new Date();
          nextMonth.setDate(nextMonth.getDate() + 30);

          await tenantRef.update({
            'subscription.status': 'active',
            'subscription.productId': subscriptionId || 'core_monthly',
            'subscription.currentPeriodEnd': Timestamp.fromDate(nextMonth),
          });
        }
      }
      // 3: CANCELED, 5: ON_HOLD, 12: REVOKED, 13: EXPIRED
      else if ([3, 5, 12, 13].includes(notificationType)) {
        const querySnap = await db
          .collection('tenants')
          .where('subscription.purchaseToken', '==', purchaseToken)
          .limit(1)
          .get();

        if (!querySnap.empty) {
          const tenantRef = querySnap.docs[0].ref;
          // Set to grace status (3 days grace)
          await tenantRef.update({
            'subscription.status': 'grace',
          });
        }
      }
    }

    res.status(200).send({ received: true });
  } catch (error) {
    console.error('Error processing RTDN webhook:', error);
    res.status(500).send('Internal Server Error');
  }
});

export const verifyPurchase = onCall(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'User must be signed in.');

  const { tenantId, productId, purchaseToken } = req.data as {
    tenantId: string;
    productId: string;
    purchaseToken: string;
  };

  if (!tenantId || !productId || !purchaseToken) {
    throw new HttpsError('invalid-argument', 'Missing purchase details.');
  }

  const db = getFirestore();

  // Verify membership and admin role
  const memberSnap = await db.doc(`tenants/${tenantId}/members/${uid}`).get();
  if (!memberSnap.exists || memberSnap.data()?.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Only admin can manage billing.');
  }

  const tenantRef = db.doc(`tenants/${tenantId}`);
  const tenantSnap = await tenantRef.get();
  if (!tenantSnap.exists) {
    throw new HttpsError('not-found', 'Tenant not found.');
  }

  const now = new Date();

  if (productId === 'core_monthly') {
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    await tenantRef.update({
      'subscription.status': 'active',
      'subscription.plan': 'core_monthly',
      'subscription.purchaseToken': purchaseToken,
      'subscription.productId': productId,
      'subscription.currentPeriodEnd': Timestamp.fromDate(periodEnd),
    });

    return { success: true, message: 'Core monthly subscription activated successfully.' };
  } else if (productId === 'storage_pack_1gb') {
    await tenantRef.update({
      'storage.purchasedGb': FieldValue.increment(1),
    });

    // Log purchase to storage ledger
    const ledgerRef = db.collection(`tenants/${tenantId}/storage_ledger`).doc();
    await ledgerRef.set({
      deltaBytes: 1024 * 1024 * 1024,
      egressBytes: 0,
      reason: 'logo_upload', // or storage pack extension
      refId: purchaseToken,
      at: FieldValue.serverTimestamp(),
    });

    return { success: true, addedGb: 1, message: '1 GB Storage Pack added successfully.' };
  } else if (productId === 'storage_pack_5gb') {
    await tenantRef.update({
      'storage.purchasedGb': FieldValue.increment(5),
    });

    return { success: true, addedGb: 5, message: '5 GB Storage Pack added successfully.' };
  } else {
    throw new HttpsError('invalid-argument', `Unknown product ID: ${productId}`);
  }
});
