# frozen_string_literal: true

module Post
  module Adapters
    class AccountAdapter
      ROLE_GUEST = 1
      ROLE_CAST = 2

      def get_user_type(user_id)
        role = get_role.call(profile_id: user_id)
        return nil unless role

        role == ROLE_CAST ? "cast" : "guest"
      end

      def get_user_types_batch(user_ids)
        # FALLBACK: Skip the cross-slice call when no user IDs are provided.
        return {} if user_ids.nil? || user_ids.empty?

        user_ids.each_with_object({}) do |user_id, hash|
          role = get_role.call(profile_id: user_id)
          next unless role

          hash[user_id] = role == ROLE_CAST ? "cast" : "guest"
        end
      end

      def user_exists?(user_id)
        !get_role.call(profile_id: user_id).nil?
      end

      private

      def get_role
        @get_role ||= Profile::Slice["use_cases.get_role"]
      end
    end
  end
end
