# frozen_string_literal: true

module Post
  module Adapters
    class AccountAdapter
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
