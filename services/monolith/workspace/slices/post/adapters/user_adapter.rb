# frozen_string_literal: true

module Post
  module Adapters
    # Anti-Corruption Layer for accessing User data from Identity slice.
    class UserAdapter
      ROLE_GUEST = 1
      ROLE_CAST = 2

      def get_user_type(user_id)
        user = identity_user_repository.find_by_id(user_id)
        return nil unless user

        user.role == ROLE_CAST ? "cast" : "guest"
      end

      def get_user_types_batch(user_ids)
        return {} if user_ids.nil? || user_ids.empty?

        users = identity_user_repository.find_by_ids(user_ids)
        users.each_with_object({}) do |user, hash|
          hash[user.id] = user.role == ROLE_CAST ? "cast" : "guest"
        end
      end

      def user_exists?(user_id)
        !identity_user_repository.find_by_id(user_id).nil?
      end

      private

      def identity_user_repository
        @identity_user_repository ||= Identity::Slice["repositories.user_repository"]
      end
    end
  end
end
