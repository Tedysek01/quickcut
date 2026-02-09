import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { triggerModalPipeline } from "../lib/modal";
import { checkUsageLimits } from "../lib/usage";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

export const onVideoUploadTrigger = functions
  .runWith({ timeoutSeconds: 300, memory: "256MB" })
  .firestore
  .document("users/{uid}/projects/{projectId}")
  .onUpdate(async (change, context) => {
    const { uid, projectId } = context.params;
    const before = change.before.data();
    const after = change.after.data();

    // Only trigger when status changes to "uploaded"
    if (before.status === "uploaded" || after.status !== "uploaded") {
      return;
    }

    console.log(`Pipeline triggered for user ${uid}, project ${projectId}`);

    try {
      // Atomic claim: use a transaction to ensure only ONE invocation proceeds.
      // This prevents duplicate pipeline runs from at-least-once delivery
      // or multiple rapid client writes.
      const projectRef = db.doc(`users/${uid}/projects/${projectId}`);
      const claimed = await db.runTransaction(async (tx) => {
        const snap = await tx.get(projectRef);
        const data = snap.data();
        if (!data) return false;

        // Skip if already claimed by another invocation
        if (data.status !== "uploaded" || data.processing?.modalJobId) {
          return false;
        }

        tx.update(projectRef, {
          status: "transcribing",
          "processing.startedAt": admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return true;
      });

      if (!claimed) {
        console.log(`Skipping — already claimed by another invocation for ${projectId}`);
        return;
      }

      // Check usage limits
      const { allowed, reason } = await checkUsageLimits(uid);
      if (!allowed) {
        await db.doc(`users/${uid}/projects/${projectId}`).update({
          status: "failed",
          failReason: reason,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return;
      }

      // Get user preferences
      const userDoc = await db.doc(`users/${uid}`).get();
      const preferences = userDoc.data()?.preferences || {};

      // Trigger Modal pipeline
      // Pass source videos for multi-video concatenation
      const sourceVideos = after.sourceVideos?.length > 1
        ? after.sourceVideos.map((sv: { storageUrl: string; order: number; originalName: string }) => ({
            storageUrl: sv.storageUrl,
            order: sv.order,
            originalName: sv.originalName,
          }))
        : undefined;

      const jobId = await triggerModalPipeline({
        uid,
        projectId,
        storageUrl: after.rawVideo?.storageUrl || after.sourceVideos?.[0]?.storageUrl,
        format: after.format,
        language: after.language || "en",
        preferences,
        sourceVideos,
      });

      await db.doc(`users/${uid}/projects/${projectId}`).update({
        "processing.modalJobId": jobId,
      });

      console.log(`Modal job ${jobId} started for project ${projectId}`);
    } catch (error) {
      console.error("Pipeline trigger error:", error);

      // Fail immediately — no self-triggering retry loop
      await db.doc(`users/${uid}/projects/${projectId}`).update({
        status: "failed",
        failReason: error instanceof Error ? error.message : "Pipeline trigger failed",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  });
