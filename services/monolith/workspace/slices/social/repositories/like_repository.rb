# frozen_string_literal: true

module Social
  module Repositories
    class LikeRepository < Social::DB::Repo
      def like(post_id:, guest_id:)
        existing = post_likes.where(post_id: post_id, guest_id: guest_id).one
        return if existing

        post_likes.changeset(:create, post_id: post_id, guest_id: guest_id).commit
      end

      def unlike(post_id:, guest_id:)
        post_likes.dataset.where(post_id: post_id, guest_id: guest_id).delete
      end

      def liked?(post_id:, guest_id:)
        post_likes.where(post_id: post_id, guest_id: guest_id).exist?
      end

      def likes_count(post_id:)
        post_likes.where(post_id: post_id).count
      end

      def likes_count_batch(post_ids:)
        return {} if post_ids.empty?

        post_likes.dataset
          .unordered
          .where(post_id: post_ids)
          .group_and_count(:post_id)
          .to_hash(:post_id, :count)
      end

      def liked_status_batch(post_ids:, guest_id:)
        return {} if post_ids.empty? || guest_id.nil?

        liked_ids = post_likes.dataset
          .where(post_id: post_ids, guest_id: guest_id)
          .select_map(:post_id)

        post_ids.each_with_object({}) do |id, hash|
          hash[id] = liked_ids.include?(id)
        end
      end
    end
  end
end
