# frozen_string_literal: true

module Review
  module UseCases
    class CheckMediaOwnership
      include Review::Deps[media_adapter: "adapters.media_adapter"]

      def call(profile_id:, media:, attached_ids: [], author_profile_id: profile_id)
        ids = media.map { |item| item[:media_id] } - attached_ids
        raise Errors::Invalid, "Only media the acting profile uploaded can be attached" unless media_adapter.owned_all?(profile_id: profile_id, ids: ids)
        raise Errors::Invalid, "Only the writing profile can attach new media" unless ids.empty? || profile_id == author_profile_id
      end
    end
  end
end
