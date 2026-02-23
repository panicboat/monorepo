# frozen_string_literal: true

module Post
  module Presenters
    class PostPresenter
      def self.to_proto(post, author: nil, likes_count: 0, comments_count: 0, liked: false, media_files: {})
        return nil unless post

        media = (post.respond_to?(:post_media) ? post.post_media : []) || []
        hashtags = (post.respond_to?(:hashtags) ? post.hashtags : []) || []

        ::Post::V1::CastPost.new(
          id: post.id.to_s,
          cast_id: post.cast_id.to_s,
          content: post.content,
          media: media.sort_by(&:position).map { |m| media_to_proto(m, media_files: media_files) },
          created_at: post.created_at.iso8601,
          author: author_to_proto(author, media_files: media_files),
          likes_count: likes_count,
          comments_count: comments_count,
          visibility: post.respond_to?(:visibility) ? post.visibility : "public",
          hashtags: hashtags.sort_by(&:position).map(&:tag),
          liked: liked
        )
      end

      def self.many_to_proto(posts, author: nil, likes_count: 0, liked: false, media_files: {})
        (posts || []).map { |p| to_proto(p, author: author, likes_count: likes_count, liked: liked, media_files: media_files) }
      end

      def self.media_to_proto(media, media_files: {})
        media_file = media_files[media.media_id]
        ::Post::V1::CastPostMedia.new(
          id: media.id.to_s,
          media_type: media.media_type,
          # FALLBACK: Returns empty string when media file URL is not available
          url: media_file&.url || "",
          thumbnail_url: media_file&.thumbnail_url || ""
        )
      end

      def self.author_to_proto(cast, media_files: {})
        return nil unless cast

        # Use avatar_media_id first, then fall back to profile_media_id
        media_id = cast.respond_to?(:avatar_media_id) && cast.avatar_media_id.to_s != "" ? cast.avatar_media_id : cast.profile_media_id
        media_file = media_files[media_id]

        ::Post::V1::CastPostAuthor.new(
          id: cast.user_id.to_s,
          # FALLBACK: Returns empty string when name or image URL is not available
          name: cast.name || "",
          image_url: media_file&.url || ""
        )
      end
    end
  end
end
