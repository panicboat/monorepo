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

      def profile_like(post_id:, profile_id:)
        existing = likes.where(post_id: post_id, profile_id: profile_id).one
        return if existing

        likes.changeset(:create, id: SecureRandom.uuid_v7, post_id: post_id, profile_id: profile_id).commit
      end

      def profile_unlike(post_id:, profile_id:)
        likes.dataset.where(post_id: post_id, profile_id: profile_id).delete
      end

      def profile_liked?(post_id:, profile_id:)
        likes.where(post_id: post_id, profile_id: profile_id).exist?
      end

      def liked_post_ids_by_profile(profile_id:, limit: 20, cursor: nil)
        scope = likes.where(profile_id: profile_id)

        if cursor
          scope = scope.where {
            (created_at < cursor[:created_at]) |
              ((created_at =~ cursor[:created_at]) & (id < cursor[:id]))
          }
        end

        scope.order { [created_at.desc, id.desc] }.limit(limit + 1).to_a
      end

      def profile_liked_status_batch(post_ids:, profile_id:)
        return {} if post_ids.empty? || profile_id.nil?

        liked_ids = likes.dataset
          .where(post_id: post_ids, profile_id: profile_id)
          .select_map(:post_id)

        post_ids.each_with_object({}) do |id, hash|
          hash[id] = liked_ids.include?(id)
        end
      end

      def delete_by_profile(profile_id)
        likes.dataset.where(profile_id: profile_id).delete
      end
    end
  end
end
