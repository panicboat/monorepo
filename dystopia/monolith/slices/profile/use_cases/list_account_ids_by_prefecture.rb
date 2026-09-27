# frozen_string_literal: true

module Profile
  module UseCases
    class ListAccountIdsByPrefecture
      include Deps["repositories.profile_repository"]

      def call(prefecture:)
        profile_repository.account_ids_by_prefecture(prefecture)
      end
    end
  end
end
