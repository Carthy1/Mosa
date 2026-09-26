/**
 * Firebase Cloud Functions for Ephemeral Social Media Platform
 * Lead Engineer & QA: MacCarthy Collins Setor
 *
 * Direct Snaps & Stories Ephemeral Cleanup Service:
 * 1. onSnapMessageViewed: Listens for messages where viewStatus becomes 'viewed' and deletes the file from Firebase Storage.
 * 2. cleanupExpiredStoriesCron: Optional scheduled fallback to clean up stories older than 24 hours.
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

/**
 * Triggered when a snap message status changes to 'viewed'
 * Permanently deletes the heavy image/video from Firebase Storage bucket.
 */
export const onSnapMessageViewed = functions.firestore
  .document('chats/{chatId}/messages/{messageId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    // Trigger only when viewStatus transitions to 'viewed'
    if (before.viewStatus !== 'viewed' && after.viewStatus === 'viewed') {
      const mediaUrl = after.content;
      const type = after.type;

      if ((type === 'image' || type === 'video') && mediaUrl) {
        try {
          // Extract storage path from Firebase Storage URL
          const bucket = admin.storage().bucket();
          const matches = mediaUrl.match(/\/o\/(.+?)\?/);
          if (matches && matches[1]) {
            const filePath = decodeURIComponent(matches[1]);
            const file = bucket.file(filePath);
            const [exists] = await file.exists();
            if (exists) {
              await file.delete();
              console.log(`[STORAGE PURGE] Successfully deleted expired ephemeral snap: ${filePath}`);
            }
          }
        } catch (error) {
          console.error('[STORAGE PURGE ERROR] Failed to delete expired snap:', error);
        }
      }
    }
  });

/**
 * Scheduled cleanup every 1 hour (as an auxiliary safety net to Firestore native TTL policy)
 */
export const cleanupExpiredStoriesCron = functions.pubsub
  .schedule('every 1 hours')
  .onRun(async (context) => {
    const now = admin.firestore.Timestamp.now();
    const expiredSnap = await admin
      .firestore()
      .collection('stories')
      .where('expiresAt', '<=', now)
      .get();

    const bucket = admin.storage().bucket();
    const batch = admin.firestore().batch();

    for (const doc of expiredSnap.docs) {
      const data = doc.data();
      if (data.mediaUrl) {
        try {
          const matches = data.mediaUrl.match(/\/o\/(.+?)\?/);
          if (matches && matches[1]) {
            const filePath = decodeURIComponent(matches[1]);
            await bucket.file(filePath).delete({ ignoreNotFound: true });
          }
        } catch (e) {
          console.error('Error deleting expired story file:', e);
        }
      }
      batch.delete(doc.ref);
    }

    await batch.commit();
    console.log(`[STORY TTL CLEANUP] Cleaned up ${expiredSnap.size} expired stories.`);
  });
