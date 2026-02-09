import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { triggerModalPipeline } from "../lib/modal";
import { checkUsageLimits } from "../lib/usage";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Manual re-process endpoint
export const startProcessing = functions.https.onCall(async (request) => {
  const { projectId } = request.data;
  const uid = request.auth?.uid;

  if (!uid) {
    throw new functions.https.HttpsError("unauthenticated", "Must be signed in");
  }

  if (!projectId) {
    throw new functions.https.HttpsError("invalid-argument", "projectId is required");
  }

  // Verify project belongs to user
  const projectRef = db.doc(`users/${uid}/projects/${projectId}`);
  const projectDoc = await projectRef.get();

  if (!projectDoc.exists) {
    throw new functions.https.HttpsError("not-found", "Project not found");
  }

  // Check limits
  const { allowed, reason } = await checkUsageLimits(uid);
  if (!allowed) {
    throw new functions.https.HttpsError("resource-exhausted", reason || "Usage limit reached");
  }

  const project = projectDoc.data()!;
  const userDoc = await db.doc(`users/${uid}`).get();
  const preferences = userDoc.data()?.preferences || {};

  // Reset and restart
  await projectRef.update({
    status: "transcribing",
    failReason: null,
    "processing.startedAt": admin.firestore.FieldValue.serverTimestamp(),
    "processing.retryCount": 0,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const jobId = await triggerModalPipeline({
    uid,
    projectId,
    storageUrl: project.rawVideo.storageUrl,
    format: project.format,
    language: project.language || "en",
    preferences,
  });

  await projectRef.update({
    "processing.modalJobId": jobId,
  });

  return { success: true, jobId };
});
