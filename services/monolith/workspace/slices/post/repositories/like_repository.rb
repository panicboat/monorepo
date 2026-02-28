# frozen_string_literal: true

module Post
  module Repositories
    class LikeRepository < Post::DB::Repo
      def like(post_id:, guest_user_id:)
        existing = likes.where(post_id: post_id, guest_user_id: guest_user_id).one
        return if existing

        likes.changeset(:create, post_id: post_id, guest_user_id: guest_user_id).commit
      end

      def unlike(post_id:, guest_user_id:)
        likes.dataset.where(post_id: post_id, guest_user_id: guest_user_id).delete
      end

      def liked?(post_id:, guest_user_id:)
        likes.where(post_id: post_id, guest_user_id: guest_user_id).exist?
      end

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

      def liked_status_batch(post_ids:, guest_user_id:)
        return {} if post_ids.empty? || guest_user_id.nil?

        liked_ids = likes.dataset
          .where(post_id: post_ids, guest_user_id: guest_user_id)
          .select_map(:post_id)

        post_ids.each_with_object({}) do |id, hash|
          hash[id] = liked_ids.include?(id)
        end
      end
    end
  end
end
