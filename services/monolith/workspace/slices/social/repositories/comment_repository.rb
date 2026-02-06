# frozen_string_literal: true

module Social
  module Repositories
    class CommentRepository < Social::DB::Repo
      def create_comment(post_id:, user_id:, content:, parent_id: nil, media: [])
        # Validate parent_id is a top-level comment (not a reply)
        if parent_id
          parent = post_comments.where(id: parent_id).one
          return nil unless parent
          return nil if parent.parent_id # Cannot reply to a reply
        end

        comment_data = {
          post_id: post_id,
          user_id: user_id,
          content: content,
          parent_id: parent_id,
          replies_count: 0
        }

        comment = post_comments.changeset(:create, comment_data).commit

        # Save media if provided
        save_media(comment_id: comment.id, media_data: media) if media.any?

        # Increment parent's replies_count if this is a reply
        if parent_id
          post_comments.dataset.where(id: parent_id).update(
            replies_count: Sequel.expr(:replies_count) + 1
          )
        end

        find_by_id(comment.id)
      end

      def delete_comment(id:, user_id:)
        comment = post_comments.where(id: id).one
        return nil unless comment
        return nil unless comment.user_id == user_id

        deleted_count = 1

        if comment.parent_id
          # This is a reply - decrement parent's replies_count
          post_comments.dataset.where(id: comment.parent_id).update(
            replies_count: Sequel.expr(:replies_count) - 1
          )
        else
          # This is a top-level comment - count replies to be deleted
          deleted_count += post_comments.where(parent_id: id).count
        end

        # Delete media first
        comment_media.dataset.where(comment_id: id).delete
        # Delete replies if top-level comment
        if comment.parent_id.nil?
          reply_ids = post_comments.dataset.where(parent_id: id).select_map(:id)
          comment_media.dataset.where(comment_id: reply_ids).delete unless reply_ids.empty?
          post_comments.dataset.where(parent_id: id).delete
        end
        # Delete the comment itself
        post_comments.dataset.where(id: id).delete

        { post_id: comment.post_id, deleted_count: deleted_count }
      end

      def find_by_id(id)
        post_comments.combine(:comment_media).where(id: id).one
      end

      def list_by_post_id(post_id:, limit: 20, cursor: nil)
        scope = post_comments.combine(:comment_media)
          .where(post_id: post_id, parent_id: nil)

        if cursor
          scope = scope.where {
            (created_at < cursor[:created_at]) |
              ((created_at =~ cursor[:created_at]) & (id < cursor[:id]))
          }
        end

        scope.order { [created_at.desc, id.desc] }.limit(limit + 1).to_a
      end

      def list_replies(parent_id:, limit: 20, cursor: nil)
        scope = post_comments.combine(:comment_media)
          .where(parent_id: parent_id)

        if cursor
          scope = scope.where {
            (created_at < cursor[:created_at]) |
              ((created_at =~ cursor[:created_at]) & (id < cursor[:id]))
          }
        end

        scope.order { [created_at.desc, id.desc] }.limit(limit + 1).to_a
      end

      def comments_count(post_id:)
        post_comments.where(post_id: post_id, parent_id: nil).count
      end

      # Batch get comments count for multiple posts.
      # Only counts top-level comments (parent_id is null).
      #
      # @param post_ids [Array<String>] the post IDs to count comments for
      # @return [Hash<String, Integer>] hash of post_id => count
      def comments_count_batch(post_ids:)
        return {} if post_ids.nil? || post_ids.empty?

        post_comments.dataset
          .unordered
          .select(:post_id)
          .where(post_id: post_ids, parent_id: nil)
          .group_and_count(:post_id)
          .to_hash(:post_id, :count)
      end

      private

      def save_media(comment_id:, media_data:)
        media_data.each_with_index do |media, index|
          comment_media.changeset(:create, media.merge(comment_id: comment_id, position: index)).commit
        end
      end
    end
  end
end
