import { TaggingStatus } from "@/stub/trust/v1/service_pb";

export { TaggingStatus };

export interface Tag {
  id: string;
  name: string;
  createdAt: string;
}

export interface Tagging {
  id: string;
  tagName: string;
  taggerId: string;
  status: TaggingStatus;
  createdAt: string;
}

export interface PendingTagging {
  id: string;
  tagName: string;
  taggerId: string;
  createdAt: string;
}
