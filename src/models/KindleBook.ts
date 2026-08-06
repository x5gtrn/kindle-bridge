export interface KindleBook {
  id: string;
  asin?: string;
  title: string;
  authors: string[];
  coverImageUrl?: string;
  amazonUrl?: string;
  lastAnnotatedAt?: string;
  region: string;
}
