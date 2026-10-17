# frozen_string_literal: true

module Karte
  module UseCases
    class CreateKarte
      ROLE_GUEST = 1

      include Karte::Deps[
        karte_repo: "repositories.karte_repository",
        event_repo: "repositories.event_repository",
        authorize_cast: "use_cases.authorize_cast",
        validate_event: "use_cases.validate_event",
        present_kartes: "use_cases.present_kartes"
      ]

      def initialize(get_role: nil, **deps)
        super(**deps)
        @get_role = get_role
      end

      def call(viewer_account_id:, viewer_profile_id:, target_profile_id:, rating:, event:)
        raise Errors::Forbidden, "Cast only" unless authorize_cast.call(viewer_account_id: viewer_account_id)
        raise Errors::Invalid, "Rating must be 1..5" unless rating.nil? || (1..5).cover?(rating)
        raise Errors::Invalid, "Target must be a guest" unless guest?(target_profile_id)

        attrs = validate_event.call(**event)
        karte = nil
        karte_repo.transaction do
          karte = karte_repo.create(
            author_account_id: viewer_account_id,
            author_profile_id: viewer_profile_id,
            target_profile_id: target_profile_id,
            rating: rating,
            occurred_on: attrs[:occurred_on]
          )
          event_repo.create(karte_id: karte.id, **attrs)
        end
        present_kartes.call(kartes: [karte], viewer_account_id: viewer_account_id).first
      end

      private

      def guest?(profile_id)
        Ids.valid?(profile_id) && get_role.call(profile_id: profile_id) == ROLE_GUEST
      end

      def get_role
        @get_role ||= ::Profile::Slice["use_cases.get_role"]
      end
    end
  end
end
