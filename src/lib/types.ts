// ─── Raw HN Firebase API shape ────────────────────────────────────────────────

export interface HNItem {
  id: number;
  type?: 'story' | 'comment' | 'job' | 'poll' | 'pollopt';
  by?: string;
  time?: number;
  text?: string;           // HTML-encoded, present on comments
  url?: string;            // present on story links
  title?: string;
  score?: number;
  descendants?: number;   // total comment count on a story
  kids?: number[];         // direct child IDs (comments)
  deleted?: boolean;
  dead?: boolean;
}

// ─── Cleaned / shaped output ──────────────────────────────────────────────────

export interface DigestComment {
  id: number;
  by: string;
  text: string;            // HTML-stripped plain text
  time: number;
}

export interface DigestPost {
  id: number;
  title: string;
  url: string;
  score: number;
  by: string;
  time: number;
  descendants: number;
  comments: DigestComment[];
}

export interface Digest {
  date: string;            // YYYY-MM-DD (UTC)
  fetchedAt: string;       // ISO8601
  posts: DigestPost[];
}
