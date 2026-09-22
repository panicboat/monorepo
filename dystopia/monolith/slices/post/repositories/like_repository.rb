# frozen_string_literal: true

module Post
  module Repositories
    class LikeRepository < Post::DB::Repo
      def likes_count(post_id:)
        likes.where(post_id: post_id).count
      end

      def likes_count_batch(post_ids:)
        return {} if post_ids.empty?

        likes.dataset
          .unordered
          .where(post_id: post_ids)
          .group_and_count(:post_id)
          .to_hash(:post_id, :count)
      end

      def account_like(post_id:, account_id:)
        existing = likes.where(post_id: post_id, account_id: account_id).one
        return if existing

        likes.changeset(:create, id: SecureRandom.uuid_v7, post_id: post_id, account_id: account_id).commit
      end

      def account_unlike(post_id:, account_id:)
        likes.dataset.where(post_id: post_id, account_id: account_id).delete
      end

      def account_liked?(post_id:, account_id:)
        likes.where(post_id: post_id, account_id: account_id).exist?
      end

      # List like rows for a single account_id, newest first.
      # Returns like rows (id, post_id, created_at) so the caller can extract post_ids
      # AND encode the next cursor using the row's created_at + id. cursor is the
      # already-decoded hash produced by `Concerns::CursorPagination#decode_cursor`.
      def liked_post_ids_by_account(account_id:, limit: 20, cursor: nil)
        scope = likes.where(account_id: account_id)

        if cursor
          scope = scope.where {
            (created_at < cursor[:created_at]) |
              ((created_at =~ cursor[:created_at]) & (id < cursor[:id]))
          }
        end

        scope.order { [created_at.desc, id.desc] }.limit(limit + 1).to_a
      end

      def account_liked_status_batch(post_ids:, account_id:)
        return {} if post_ids.empty? || account_id.nil?

        liked_ids = likes.dataset
          .where(post_id: post_ids, account_id: account_id)
          .select_map(:post_id)

        post_ids.each_with_object({}) do |id, hash|
          hash[id] = liked_ids.include?(id)
        end
      end

      def delete_by_account(account_id)
        likes.dataset.where(account_id: account_id).delete
      end
    end
  end
end
