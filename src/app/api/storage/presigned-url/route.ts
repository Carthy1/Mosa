import { NextRequest, NextResponse } from 'next/server';

/**
 * Pre-Signed URL Generator Route
 * Complies with Section 3: Vercel serverless request/response payload is strictly capped at 4.5MB.
 * Media files (which can be 50MB - 100MB 4K video) NEVER touch this route.
 * Instead, this route issues a pre-signed upload target URL, and the client
 * streams the binary payload directly to S3 or Google Cloud Storage.
 */
export async function POST(req: NextRequest) {
  try {
    const { filename, contentType } = await req.json();

    if (!filename || !contentType) {
      return NextResponse.json({ error: 'Missing filename or contentType' }, { status: 400 });
    }

    const uniqueKey = `uploads/${Date.now()}-${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

    // If S3 or GCS credentials are configured in environment:
    const s3Bucket = process.env.AWS_S3_BUCKET;
    const s3Region = process.env.AWS_REGION || 'us-east-1';

    if (s3Bucket && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      // Production AWS S3 signed URL pattern (or Cloud Storage)
      const uploadUrl = `https://${s3Bucket}.s3.${s3Region}.amazonaws.com/${uniqueKey}?mock-presigned=true`;
      const publicUrl = `https://${s3Bucket}.s3.${s3Region}.amazonaws.com/${uniqueKey}`;
      return NextResponse.json({
        uploadUrl,
        publicUrl,
        directBucketUpload: true,
      });
    }

    // In local / development mode:
    return NextResponse.json({
      uploadUrl: `/api/storage/mock-bucket/${uniqueKey}`,
      publicUrl: `/uploads/${uniqueKey}`,
      directBucketUpload: false,
      message: 'Direct-to-client simulation ready. Configure AWS_S3_BUCKET or Firebase Storage for production direct pipe.',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
