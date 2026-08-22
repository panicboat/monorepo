# frozen_string_literal: true

module Post
  module Presenters
    class PostPresenter
      def self.to_post_proto(post, author: nil, likes_count: 0, comments_count: 0, liked: false, media_files: {})
        return nil unless post

        media = (post.respond_to?(:post_media) ? post.post_media : []) || []
        hashtags = (post.respond_to?(:hashtags) ? post.hashtags : []) || []

        ::Post::V1::Post.new(
          id: post.id.to_s,
          author_id: post.author_id.to_s,
          content: post.content,
          media: media.sort_by(&:position).map { |m| post_media_to_proto(m, media_files: media_files) },
          created_at: post.created_at.iso8601,
          author: post_author_to_proto(author),
          likes_count: likes_count,
          comments_count: comments_count,
          visibility: post.respond_to?(:visibility) ? post.visibility : "public",
          hashtags: hashtags.sort_by(&:position).map(&:tag),
          liked: liked
        )
      end

      def self.post_media_to_proto(media, media_files: {})
        media_file = media_files[media.media_id]
        ::Post::V1::PostMedia.new(
          id: media.id.to_s,
          media_type: media.media_type,
          url: media_file&.url || "",
          thumbnail_url: media_file&.thumbnail_url || "",
          media_id: media.media_id.to_s
        )
      end

      def self.post_author_to_proto(author)
        return nil unless author

        ::Post::V1::PostAuthor.new(
          account_id: author.account_id.to_s,
          display_name: author.display_name || "",
          username: author.username || "",
          avatar_url: author.avatar_url || ""
        )
      end
    end
  end
end
