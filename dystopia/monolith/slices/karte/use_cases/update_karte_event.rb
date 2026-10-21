# frozen_string_literal: true

module Karte
  module UseCases
    class UpdateKarteEvent
      include Karte::Deps[
        karte_repo: "repositories.karte_repository",
        event_repo: "repositories.event_repository",
        authorize_cast: "use_cases.authorize_cast",
        load_own_karte: "use_cases.load_own_karte",
        validate_event: "use_cases.validate_event",
        present_kartes: "use_cases.present_kartes"
      ]

      def call(viewer_account_id:, event_id:, event:)
        raise Errors::Forbidden, "Cast only" unless authorize_cast.call(viewer_account_id: viewer_account_id)

        karte = karte_repo.transaction do
          record = find_event(event_id)
          locked = load_own_karte.call(viewer_account_id: viewer_account_id, karte_id: record.karte_id, lock: true)
          event_repo.update(find_event(event_id).id, **validate_event.call(**event))
          karte_repo.touch(locked.id)
          karte_repo.refresh_last_occurred_on(locked.id)
          locked
        end
        present_kartes.call(kartes: [karte_repo.find(karte.id)], viewer_account_id: viewer_account_id).first
      end

      private

      def find_event(event_id)
        record = Ids.valid?(event_id) ? event_repo.find(event_id) : nil
        raise Errors::Invalid, "Event not found" unless record

        record
      end
    end
  end
end
