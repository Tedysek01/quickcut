import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { notifyProcessingComplete, notifyProcessingFailed } from "../lib/notifications";

if (!admin.apps.length) {
  admin.initializeApp();
}

export const onProjectUpdateTrigger = functions.firestore
  .document("users/{uid}/projects/{projectId}")
  .onUpdate(async (change, context) => {
    const { uid, projectId } = context.params;
    const before = change.before.data();
    const after = change.after.data();

    // Notify when processing completes
    if (before.status !== "done" && after.status === "done") {
      await notifyProcessingComplete(uid, projectId);
    }

    // Notify when processing fails
    if (before.status !== "failed" && after.status === "failed") {
      await notifyProcessingFailed(uid, projectId, after.failReason || "Unknown error");
    }
  });
