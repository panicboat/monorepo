# frozen_string_literal: true

module Karte
  module UseCases
    class DeleteKarteEvent
      include Karte::Deps[
        karte_repo: "repositories.karte_repository",
        event_repo: "repositories.event_repository",
        load_own_karte: "use_cases.load_own_karte",
        present_kartes: "use_cases.present_kartes"
      ]

      def call(viewer_account_id:, event_id:)
        record = Ids.valid?(event_id) ? event_repo.find(event_id) : nil
        raise Errors::Invalid, "Event not found" unless record

        karte = load_own_karte.call(viewer_account_id: viewer_account_id, karte_id: record.karte_id, require_open: true)
        raise Errors::Invalid, "A karte keeps at least one event" if event_repo.count_for(karte.id) <= 1

        karte_repo.transaction do
          event_repo.delete(record.id)
          karte_repo.touch(karte.id)
        end
        present_kartes.call(kartes: [karte_repo.find(karte.id)], viewer_account_id: viewer_account_id).first
      end
    end
  end
end
