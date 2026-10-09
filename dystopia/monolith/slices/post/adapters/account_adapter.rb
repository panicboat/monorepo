# frozen_string_literal: true

module Post
  module Adapters
    class AccountAdapter
      ROLE_GUEST = 1
      ROLE_CAST = 2

      def get_user_type(profile_id)
        role = get_role.call(profile_id: profile_id)
        return nil unless role

        role == ROLE_CAST ? "cast" : "guest"
      end

      def get_user_types_batch(profile_ids)
        # FALLBACK: Skip the cross-slice call when no profile IDs are provided.
        return {} if profile_ids.nil? || profile_ids.empty?

        profile_ids.each_with_object({}) do |profile_id, hash|
          role = get_role.call(profile_id: profile_id)
          next unless role

          hash[profile_id] = role == ROLE_CAST ? "cast" : "guest"
        end
      end

      def profile_exists?(profile_id)
        !get_role.call(profile_id: profile_id).nil?
      end

      private

      def get_role
        @get_role ||= Profile::Slice["use_cases.get_role"]
      end
    end
  end
end
