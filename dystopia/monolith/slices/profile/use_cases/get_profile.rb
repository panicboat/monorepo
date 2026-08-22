# frozen_string_literal: true

module Profile
  module UseCases
    class GetProfile
      include Deps["repositories.profile_repository"]

      def call(account_id:)
        return nil if account_id.nil? || account_id.to_s.empty?

        profile_repository.find_by_account_id(account_id)
      end
    end
  end
end
