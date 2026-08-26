# frozen_string_literal: true

module Post
  module Adapters
    # Anti-Corruption Layer for accessing Account data from Identity slice.
    class AccountAdapter
      ROLE_GUEST = 1
      ROLE_CAST = 2

      def get_user_type(user_id)
        account = identity_account_repository.find_by_id(user_id)
        return nil unless account

        account.role == ROLE_CAST ? "cast" : "guest"
      end

      def get_user_types_batch(user_ids)
        # FALLBACK: Skip cross-slice call when no user_ids are given
        return {} if user_ids.nil? || user_ids.empty?

        user_ids.each_with_object({}) do |user_id, hash|
          account = identity_account_repository.find_by_id(user_id)
          next unless account

          hash[account.id] = account.role == ROLE_CAST ? "cast" : "guest"
        end
      end

      def user_exists?(user_id)
        !identity_account_repository.find_by_id(user_id).nil?
      end

      private

      def identity_account_repository
        @identity_account_repository ||= Identity::Slice["repositories.account_repository"]
      end
    end
  end
end
