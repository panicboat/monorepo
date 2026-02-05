# frozen_string_literal: true

module Social
  module Presenters
    class CommentPresenter
      def self.to_proto(comment, author: nil)
        return nil unless comment

        media = (comment.respond_to?(:comment_media) ? comment.comment_media : []) || []

        ::Social::V1::Comment.new(
          id: comment.id.to_s,
          post_id: comment.post_id.to_s,
          parent_id: comment.parent_id.to_s,
          user_id: comment.user_id.to_s,
          content: comment.content,
          created_at: comment.created_at.iso8601,
          author: author_to_proto(author),
          media: media.sort_by(&:position).map { |m| media_to_proto(m) },
          replies_count: comment.replies_count || 0
        )
      end

      def self.many_to_proto(comments, authors: {})
        (comments || []).map do |c|
          author = authors[c.user_id]
          to_proto(c, author: author)
        end
      end

      def self.media_to_proto(media)
        ::Social::V1::CommentMedia.new(
          id: media.id.to_s,
          media_type: media.media_type,
          url: Storage.download_url(key: media.url),
          thumbnail_url: media.thumbnail_url ? Storage.download_url(key: media.thumbnail_url) : ""
        )
      end

      def self.author_to_proto(author_info)
        return nil unless author_info

        ::Social::V1::CommentAuthor.new(
          id: author_info[:id].to_s,
          name: author_info[:name] || "",
          image_url: author_info[:image_url] || "",
          user_type: author_info[:user_type] || "guest"
        )
      end
    end
  end
end
