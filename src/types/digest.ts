export interface Comment {
  id: number;
  by: string;
  text: string;
  time: number;
}

export interface Post {
  id: number;
  title: string;
  url: string;
  score: number;
  by: string;
  time: number;
  descendants: number;
  comments: Comment[];
}

export interface Digest {
  date: string;
  fetchedAt: string;
  posts: Post[];
}
