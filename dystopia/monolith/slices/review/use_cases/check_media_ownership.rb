# frozen_string_literal: true

module Review
  module UseCases
    class CheckMediaOwnership
      include Review::Deps[media_adapter: "adapters.media_adapter"]

      def call(profile_id:, media:, attached_ids: [])
        ids = media.map { |item| item[:media_id] } - attached_ids
        return if media_adapter.owned_all?(profile_id: profile_id, ids: ids)

        raise Errors::Invalid, "Only media the acting profile uploaded can be attached"
      end
    end
  end
end
