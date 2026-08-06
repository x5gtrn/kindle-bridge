export type AnnotationType = "highlight" | "memo";

export interface KindleAnnotation {
  id: string;
  bookId: string;
  type: AnnotationType;
  text: string;
  memo?: string;
  location?: string;
  page?: string;
  createdAt?: string;
  sourceUrl?: string;
  contentHash: string;
}
