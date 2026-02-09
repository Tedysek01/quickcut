import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp();
}

// Delete raw videos older than 7 days
export const cleanupStorage = functions.pubsub
  .schedule("every 24 hours")
  .onRun(async () => {
    const bucket = admin.storage().bucket();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [files] = await bucket.getFiles({ prefix: "raw/" });

    let deleted = 0;
    for (const file of files) {
      const metadata = file.metadata;
      const created = new Date(metadata.timeCreated as string);
      if (created < sevenDaysAgo) {
        await file.delete();
        deleted++;
      }
    }

    console.log(`Cleaned up ${deleted} raw video files`);
  });

// Reset usage counters on 1st of each month
export const resetMonthlyUsage = functions.pubsub
  .schedule("0 0 1 * *")
  .timeZone("UTC")
  .onRun(async () => {
    const db = admin.firestore();
    const users = await db.collection("users").get();

    const batch = db.batch();
    for (const userDoc of users.docs) {
      batch.update(userDoc.ref, {
        "usage.clipsThisMonth": 0,
        "usage.resetDate": admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();

    console.log(`Reset usage for ${users.size} users`);
  });
