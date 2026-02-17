# frozen_string_literal: true

require "storage"

module Feed
  module Presenters
    class FeedPresenter
      def self.to_proto(post, author: nil, likes_count: 0, comments_count: 0, liked: false)
        return nil unless post

        media = extract_media(post)
        hashtags = extract_hashtags(post)

        ::Feed::V1::FeedPost.new(
          id: post.id.to_s,
          cast_id: post.cast_id.to_s,
          content: post.content,
          media: media.sort_by(&:position).map { |m| media_to_proto(m) },
          created_at: post.created_at.iso8601,
          author: author_to_proto(author),
          likes_count: likes_count,
          comments_count: comments_count,
          visibility: post.respond_to?(:visibility) ? post.visibility : "public",
          hashtags: hashtags.sort_by(&:position).map(&:tag),
          liked: liked
        )
      end

      def self.many_to_proto(posts, authors: {}, likes_counts: {}, comments_counts: {}, liked_status: {})
        (posts || []).map do |post|
          to_proto(
            post,
            author: authors[post.cast_id],
            likes_count: likes_counts[post.id] || 0,
            comments_count: comments_counts[post.id] || 0,
            liked: liked_status[post.id] || false
          )
        end
      end

      def self.media_to_proto(media)
        ::Feed::V1::FeedMedia.new(
          id: media.id.to_s,
          media_type: media.media_type,
          url: Storage.download_url(key: media.url),
          thumbnail_url: media.thumbnail_url ? Storage.download_url(key: media.thumbnail_url) : ""
        )
      end

      def self.author_to_proto(cast)
        return nil unless cast

        avatar_key = cast.respond_to?(:avatar_path) ? cast.avatar_path : nil
        avatar_key = nil if avatar_key.to_s.empty?
        image_key = avatar_key || cast.image_path

        ::Feed::V1::FeedAuthor.new(
          id: cast.user_id.to_s,
          name: cast.name || "",
          image_url: image_key ? Storage.download_url(key: image_key) : ""
        )
      end

      private_class_method def self.extract_media(post)
        post.post_media || []
      end

      private_class_method def self.extract_hashtags(post)
        post.hashtags || []
      end
    end
  end
end
