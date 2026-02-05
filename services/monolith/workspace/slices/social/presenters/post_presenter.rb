# frozen_string_literal: true

module Social
  module Presenters
    class PostPresenter
      def self.to_proto(post, author: nil, likes_count: 0, comments_count: 0, liked: false)
        return nil unless post

        media = (post.respond_to?(:cast_post_media) ? post.cast_post_media : []) || []
        hashtags = (post.respond_to?(:cast_post_hashtags) ? post.cast_post_hashtags : []) || []

        ::Social::V1::CastPost.new(
          id: post.id.to_s,
          cast_id: post.cast_id.to_s,
          content: post.content,
          media: media.sort_by(&:position).map { |m| media_to_proto(m) },
          created_at: post.created_at.iso8601,
          author: author_to_proto(author),
          likes_count: likes_count,
          comments_count: comments_count,
          visible: post.respond_to?(:visible) ? post.visible : true,
          hashtags: hashtags.sort_by(&:position).map(&:tag),
          liked: liked
        )
      end

      def self.many_to_proto(posts, author: nil, likes_count: 0, liked: false)
        (posts || []).map { |p| to_proto(p, author: author, likes_count: likes_count, liked: liked) }
      end

      def self.media_to_proto(media)
        ::Social::V1::CastPostMedia.new(
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

        ::Social::V1::CastPostAuthor.new(
          id: cast.user_id.to_s,
          name: cast.name || "",
          image_url: image_key ? Storage.download_url(key: image_key) : ""
        )
      end
    end
  end
end
