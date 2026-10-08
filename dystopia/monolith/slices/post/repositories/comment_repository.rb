# frozen_string_literal: true

module Post
  module Repositories
    class CommentRepository < Post::DB::Repo
      def create_comment(post_id:, author_profile_id:, content:, parent_id: nil, media: [], mentions: [])
        if parent_id
          parent = comments.where(id: parent_id).one
          return nil unless parent
          return nil if parent.parent_id # Cannot reply to a reply
        end

        comment_data = {
          id: SecureRandom.uuid_v7,
          post_id: post_id,
          author_profile_id: author_profile_id,
          content: content,
          parent_id: parent_id,
          replies_count: 0
        }

        comment = comments.changeset(:create, comment_data).commit

        save_media(comment_id: comment.id, media_data: media) if media.any?
        save_mentions(comment_id: comment.id, mentions: mentions) if mentions.any?

        if parent_id
          comments.dataset.where(id: parent_id).update(
            replies_count: Sequel.expr(:replies_count) + 1
          )
        end

        find_by_id(comment.id)
      end

      def delete_comment(id:, author_profile_id:)
        comment = comments.where(id: id).one
        return nil unless comment
        return nil unless comment.author_profile_id == author_profile_id

        deleted_count = 1

        if comment.parent_id
          comments.dataset.where(id: comment.parent_id).update(
            replies_count: Sequel.expr(:replies_count) - 1
          )
        else
          deleted_count += comments.where(parent_id: id).count
        end

        comment_media.dataset.where(comment_id: id).delete
        if comment.parent_id.nil?
          reply_ids = comments.dataset.where(parent_id: id).select_map(:id)
          comment_media.dataset.where(comment_id: reply_ids).delete unless reply_ids.empty?
          comments.dataset.where(parent_id: id).delete
        end
        comments.dataset.where(id: id).delete

        { post_id: comment.post_id, deleted_count: deleted_count }
      end

      def find_by_id(id)
        comments.combine(:comment_media, :comment_mentions).where(id: id).one
      end

      def list_by_post_id(post_id:, limit: 20, cursor: nil, exclude_author_profile_ids: nil)
        scope = comments.combine(:comment_media, :comment_mentions)
          .where(post_id: post_id, parent_id: nil)
        scope = scope.exclude(author_profile_id: exclude_author_profile_ids) if exclude_author_profile_ids && !exclude_author_profile_ids.empty?

        if cursor
          scope = scope.where {
            (created_at < cursor[:created_at]) |
              ((created_at =~ cursor[:created_at]) & (id < cursor[:id]))
          }
        end

        scope.order { [created_at.desc, id.desc] }.limit(limit + 1).to_a
      end

      def list_replies(parent_id:, limit: 20, cursor: nil, exclude_author_profile_ids: nil)
        scope = comments.combine(:comment_media, :comment_mentions)
          .where(parent_id: parent_id)
        scope = scope.exclude(author_profile_id: exclude_author_profile_ids) if exclude_author_profile_ids && !exclude_author_profile_ids.empty?

        if cursor
          scope = scope.where {
            (created_at < cursor[:created_at]) |
              ((created_at =~ cursor[:created_at]) & (id < cursor[:id]))
          }
        end

        scope.order { [created_at.desc, id.desc] }.limit(limit + 1).to_a
      end

      def list_by_author(author_profile_id:, limit: 20, cursor: nil)
        scope = comments.combine(:comment_media, :comment_mentions).where(author_profile_id: author_profile_id)

        if cursor
          scope = scope.where {
            (created_at < cursor[:created_at]) |
              ((created_at =~ cursor[:created_at]) & (id < cursor[:id]))
          }
        end

        scope.order { [created_at.desc, id.desc] }.limit(limit + 1).to_a
      end

      def comments_count(post_id:, exclude_author_profile_ids: nil)
        scope = comments.where(post_id: post_id, parent_id: nil)
        scope = scope.exclude(author_profile_id: exclude_author_profile_ids) if exclude_author_profile_ids && !exclude_author_profile_ids.empty?
        scope.count
      end

      def comments_count_batch(post_ids:, exclude_author_profile_ids: nil)
        return {} if post_ids.nil? || post_ids.empty?

        scope = comments.dataset
          .unordered
          .select(:post_id)
          .where(post_id: post_ids, parent_id: nil)

        scope = scope.exclude(author_profile_id: exclude_author_profile_ids) if exclude_author_profile_ids && !exclude_author_profile_ids.empty?

        scope.group_and_count(:post_id).to_hash(:post_id, :count)
      end

      def delete_by_profile(profile_id)
        comments.dataset.where(author_profile_id: profile_id).delete
      end

      private

      def save_media(comment_id:, media_data:)
        media_data.each_with_index do |media, index|
          comment_media.changeset(:create, media.merge(id: SecureRandom.uuid_v7, comment_id: comment_id, position: index)).commit
        end
      end

      def save_mentions(comment_id:, mentions:)
        mentions.each do |mention|
          comment_mentions.changeset(
            :create,
            id: SecureRandom.uuid_v7,
            comment_id: comment_id,
            profile_id: mention[:profile_id],
            position: mention[:position],
            length: mention[:length]
          ).commit
        end
      end
    end
  end
end
