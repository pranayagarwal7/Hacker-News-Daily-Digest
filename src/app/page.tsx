import { readFileSync } from 'fs';
import { join } from 'path';
import { Digest } from '@/types/digest';
import DigestClient from './DigestClient';

export default function Home() {
  let digest: Digest | null = null;
  try {
    const filePath = join(process.cwd(), 'public', 'data', 'digest.json');
    const raw = readFileSync(filePath, 'utf-8');
    digest = JSON.parse(raw);
  } catch {
    // digest.json not committed yet — user can hit Refresh in the UI
  }

  return <DigestClient initialDigest={digest} />;
}
