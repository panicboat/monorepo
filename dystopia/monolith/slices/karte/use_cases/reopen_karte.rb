# frozen_string_literal: true

module Karte
  module UseCases
    class ReopenKarte
      include Karte::Deps[
        karte_repo: "repositories.karte_repository",
        load_own_karte: "use_cases.load_own_karte",
        present_kartes: "use_cases.present_kartes"
      ]

      def call(viewer_account_id:, karte_id:)
        reopened = karte_repo.transaction do
          karte = load_own_karte.call(viewer_account_id: viewer_account_id, karte_id: karte_id, lock: true)
          raise Errors::Invalid, "Karte is open" unless karte.status == "closed"

          karte_repo.reopen(karte.id)
        end
        present_kartes.call(kartes: [reopened], viewer_account_id: viewer_account_id).first
      end
    end
  end
end
