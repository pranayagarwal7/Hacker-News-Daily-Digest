import type { Digest } from '@/lib/types';
import DigestClient from './DigestClient';

// Re-render at most every 5 minutes so edge-cached pages stay reasonably fresh
// between daily Actions deploys.
export const revalidate = 300;

export default async function Home() {
  let digest: Digest | null = null;
  try {
    // VERCEL_URL is set automatically by Vercel on every deployment.
    // For local dev it falls back to localhost:3000.
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : `http://localhost:${process.env.PORT ?? '3000'}`;

    const res = await fetch(`${baseUrl}/data/digest.json`, {
      next: { revalidate: 300 },
    });
    if (res.ok) digest = (await res.json()) as Digest;
  } catch {
    // digest.json not yet committed — DigestClient shows the empty state
  }

  return <DigestClient initialDigest={digest} />;
}
