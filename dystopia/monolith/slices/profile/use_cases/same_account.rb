# frozen_string_literal: true

module Profile
  module UseCases
    class SameAccount
      include Deps["repositories.profile_repository"]

      def call(profile_id:, other_profile_id:)
        first = profile_repository.find_by_id(profile_id)
        second = profile_repository.find_by_id(other_profile_id)

        !first.nil? && !second.nil? && first.account_id == second.account_id
      end
    end
  end
end
