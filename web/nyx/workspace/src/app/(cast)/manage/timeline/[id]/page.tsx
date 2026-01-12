"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { feed, FeedItem } from "@/modules/discovery/components/guest/TimelineFeed";
import { Button } from "@/components/ui/Button";
import { ChevronLeft, Heart, MessageCircle, Trash2, Calendar } from "lucide-react";

export default function PostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  // Mock fetch logic
  const post = feed.find((p) => p.id === id);

  if (!post) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <p className="text-slate-500">Post not found.</p>
        <Button onClick={() => router.back()}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">


      {/* Post Content */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
        <div className="p-4 flex items-center justify-between border-b border-slate-50">
          <div className="flex items-center gap-3">
            <img
              src={post.castImage}
              alt={post.castName}
              className="h-10 w-10 rounded-full border border-slate-100"
            />
            <div>
              <div className="font-bold text-slate-800">{post.castName}</div>
              <div className="flex items-center gap-1 text-xs text-slate-400">
                <Calendar size={12} />
                {post.time}
              </div>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="text-slate-300 hover:text-red-500">
            <Trash2 size={18} />
          </Button>
        </div>

        <div className="p-4">
          <p className="text-base leading-relaxed text-slate-700 whitespace-pre-wrap mb-4">
            {post.content}
          </p>

          {post.mediaUrl && (
            <div className="rounded-xl overflow-hidden bg-black/5">
              {post.mediaType === 'video' ? (
                <video
                  src={post.mediaUrl}
                  className="w-full h-auto max-h-[600px]"
                  controls
                  playsInline
                  autoPlay
                />
              ) : (
                <img
                  src={post.mediaUrl}
                  alt="Post media"
                  className="w-full h-auto"
                />
              )}
            </div>
          )}

          {!post.mediaUrl && post.image && ( // Fallback
            <div className="rounded-xl overflow-hidden">
              <img
                src={post.image}
                alt="Post media"
                className="w-full h-auto"
              />
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center gap-6">
          <div className="flex items-center gap-2 text-slate-500">
            <Heart size={20} />
            <span className="font-bold">{post.likes}</span>
            <span className="text-xs font-normal">Likes</span>
          </div>
          <div className="flex items-center gap-2 text-slate-500">
            <MessageCircle size={20} />
            <span className="font-bold">{post.comments}</span>
            <span className="text-xs font-normal">Comments</span>
          </div>
        </div>
      </div>

      {/* Mock Comments Section */}
      <div className="space-y-4">
        <h3 className="font-serif font-bold text-slate-800">Comments</h3>
        {post.comments === 0 ? (
          <p className="text-slate-400 text-sm">No comments yet.</p>
        ) : (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex gap-3 p-3 bg-white rounded-xl border border-slate-100">
                <div className="w-8 h-8 rounded-full bg-slate-200" />
                <div>
                  <p className="text-xs font-bold text-slate-600">Guest User {i + 1}</p>
                  <p className="text-sm text-slate-700">This is a mock comment for demonstration.</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
