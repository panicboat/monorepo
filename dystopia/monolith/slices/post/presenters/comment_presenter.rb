# frozen_string_literal: true

module Post
  module Presenters
    class CommentPresenter
      def self.to_proto(comment, author: nil, media_files: {}, mentioned_usernames: {})
        return nil unless comment

        media = (comment.respond_to?(:comment_media) ? comment.comment_media : []) || []
        mentions = (comment.respond_to?(:comment_mentions) ? comment.comment_mentions : []) || []

        ::Post::V1::Comment.new(
          id: comment.id.to_s,
          post_id: comment.post_id.to_s,
          parent_id: comment.parent_id.to_s,
          user_id: comment.user_id.to_s,
          content: comment.content,
          created_at: comment.created_at.iso8601,
          author: author_to_proto(author),
          media: media.sort_by(&:position).map { |m| media_to_proto(m, media_files: media_files) },
          replies_count: comment.replies_count || 0,
          mentions: mentions.map { |m| mention_to_proto(m, mentioned_usernames: mentioned_usernames) }
        )
      end

      def self.many_to_proto(comments, authors: {}, media_files: {}, mentioned_usernames: {})
        (comments || []).map do |c|
          author = authors[c.user_id]
          to_proto(c, author: author, media_files: media_files, mentioned_usernames: mentioned_usernames)
        end
      end

      def self.media_to_proto(media, media_files: {})
        media_file = media_files[media.media_id]
        ::Post::V1::CommentMedia.new(
          id: media.id.to_s,
          media_type: media.media_type,
          # FALLBACK: Use an empty string when the media file is unavailable.
          url: media_file&.url || "",
          thumbnail_url: media_file&.thumbnail_url || "",
          media_id: media.media_id.to_s
        )
      end

      def self.mention_to_proto(mention, mentioned_usernames: {})
        ::Post::V1::PostMention.new(
          account_id: mention.account_id.to_s,
          username: mentioned_usernames[mention.account_id.to_s] || "",
          position: mention.position,
          length: mention.length
        )
      end

      def self.author_to_proto(author_info)
        return nil unless author_info

        ::Post::V1::CommentAuthor.new(
          user_id: author_info[:id].to_s,
          name: author_info[:name] || "",
          image_url: author_info[:image_url] || "",
          user_type: author_info[:user_type] || "guest",
          username: author_info[:username] || ""
        )
      end
    end
  end
end
