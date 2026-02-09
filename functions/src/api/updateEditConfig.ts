import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { triggerModalRerender } from "../lib/modal";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Update edit config and trigger re-render of a single clip
export const updateEditConfig = functions
  .runWith({ timeoutSeconds: 300, memory: "256MB" })
  .https.onCall(async (request) => {
  const { projectId, clipId, editConfig, exportSettings } = request.data;
  const uid = request.auth?.uid;

  if (!uid) {
    throw new functions.https.HttpsError("unauthenticated", "Must be signed in");
  }

  if (!projectId || !clipId || !editConfig) {
    throw new functions.https.HttpsError("invalid-argument", "projectId, clipId, and editConfig are required");
  }

  const clipRef = db.doc(`users/${uid}/projects/${projectId}/clips/${clipId}`);
  const clipDoc = await clipRef.get();

  if (!clipDoc.exists) {
    throw new functions.https.HttpsError("not-found", "Clip not found");
  }

  // Update edit config, export settings, and set status to rendering
  await clipRef.update({
    editConfig,
    status: "rendering",
    ...(exportSettings ? { exportSettings } : {}),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Get project data for source video URL
  const projectDoc = await db.doc(`users/${uid}/projects/${projectId}`).get();
  const project = projectDoc.data()!;

  // Trigger re-render on Modal (rerender action, not full pipeline)
  const jobId = await triggerModalRerender(
    uid,
    projectId,
    clipId,
    project.rawVideo.storageUrl,
  );

  return { success: true, jobId };
});
