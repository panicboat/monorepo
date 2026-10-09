# frozen_string_literal: true

module Profile
  module UseCases
    class ListMyProfiles
      include Deps["repositories.profile_repository"]

      def call(account_id:)
        profile_repository.list_by_account(account_id)
      end
    end
  end
end
