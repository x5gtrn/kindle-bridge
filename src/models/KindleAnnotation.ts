export type AnnotationType = "highlight" | "note";

export interface KindleAnnotation {
  id: string;
  bookId: string;
  type: AnnotationType;
  text: string;
  note?: string;
  location?: string;
  page?: string;
  createdAt?: string;
  sourceUrl?: string;
  contentHash: string;
}
