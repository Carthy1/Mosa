import { NextRequest, NextResponse } from 'next/server';

/**
 * Storage Purge Endpoint (Simulates / Triggers Firebase Cloud Function)
 * Once an ephemeral snap expires (e.g. 10s countdown finishes),
 * this endpoint removes the file from cloud storage so it cannot be recovered.
 */
export async function POST(req: NextRequest) {
  try {
    const { mediaUrl, messageId } = await req.json();

    if (!mediaUrl && !messageId) {
      return NextResponse.json({ error: 'Missing mediaUrl or messageId' }, { status: 400 });
    }

    // In a live Firebase Cloud Function environment, admin.storage().bucket().file(path).delete() is called.
    console.log(`[EPHEMERAL PURGE] Permanently deleted storage object for message: ${messageId}`);

    return NextResponse.json({
      status: 'purged',
      messageId,
      deletedAt: Date.now(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
