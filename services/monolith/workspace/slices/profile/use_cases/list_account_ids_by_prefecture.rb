# frozen_string_literal: true

module Profile
  module UseCases
    # Cross-slice query: feed slice (and any future consumer) needs the set of
    # account ids whose profile.prefecture matches a given value to power
    # location-based tabs/filters. Stays thin — the heavy lifting (and any
    # future caching / index tuning) lives in the repository.
    #
    # Does NOT apply account-level visibility (profile.is_private) filtering;
    # that follow-gate is the social slice's responsibility and is deferred
    # per the feed slice design spec.
    class ListAccountIdsByPrefecture
      include Deps["repositories.profile_repository"]

      # @param prefecture [String, nil] prefecture name to filter by
      # @return [Array<String>] account ids (UUID strings); empty when prefecture is blank
      def call(prefecture:)
        profile_repository.account_ids_by_prefecture(prefecture)
      end
    end
  end
end
