import * as React from "react";
import { Avatar } from "./avatar";
import { cn } from "@/lib/utils";

export interface PostCardProps {
  author: { name: string; handle: string; avatarSrc?: string };
  time: string;
  body: string;
  images?: string[];
  reactions?: React.ReactNode;
  className?: string;
}

export function PostCard({
  author,
  time,
  body,
  images,
  reactions,
  className,
}: PostCardProps) {
  return (
    <article className={cn("border-b border-divider px-4 py-3", className)}>
      <div className="flex gap-3">
        <Avatar src={author.avatarSrc} fallback={author.name.slice(0, 1)} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 text-sm">
            <span className="font-bold text-text-primary">{author.name}</span>
            <span className="text-text-secondary">@{author.handle}</span>
            <span className="text-text-muted">· {time}</span>
          </div>
          <p className="mt-1 whitespace-pre-wrap text-text-primary">{body}</p>
          {images && images.length > 0 && (
            <div
              className={cn(
                "mt-2 grid gap-1 overflow-hidden rounded-md",
                images.length === 1 ? "grid-cols-1" : "grid-cols-2"
              )}
            >
              {images.slice(0, 4).map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt=""
                  className="aspect-video w-full object-cover"
                />
              ))}
            </div>
          )}
          {reactions && (
            <div className="mt-3 flex items-center gap-6 text-text-secondary">
              {reactions}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
