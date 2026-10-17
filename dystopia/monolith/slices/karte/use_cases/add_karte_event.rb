# frozen_string_literal: true

module Karte
  module UseCases
    class AddKarteEvent
      include Karte::Deps[
        karte_repo: "repositories.karte_repository",
        event_repo: "repositories.event_repository",
        load_own_karte: "use_cases.load_own_karte",
        validate_event: "use_cases.validate_event",
        present_kartes: "use_cases.present_kartes"
      ]

      def call(viewer_account_id:, karte_id:, event:)
        karte = karte_repo.transaction do
          locked = load_own_karte.call(viewer_account_id: viewer_account_id, karte_id: karte_id, require_open: true, lock: true)
          event_repo.create(karte_id: locked.id, **validate_event.call(**event))
          karte_repo.touch(locked.id)
          locked
        end
        present_kartes.call(kartes: [karte_repo.find(karte.id)], viewer_account_id: viewer_account_id).first
      end
    end
  end
end
