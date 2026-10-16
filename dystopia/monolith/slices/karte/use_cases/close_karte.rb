# frozen_string_literal: true

module Karte
  module UseCases
    class CloseKarte
      include Karte::Deps[
        karte_repo: "repositories.karte_repository",
        load_own_karte: "use_cases.load_own_karte",
        present_kartes: "use_cases.present_kartes"
      ]

      def call(viewer_account_id:, karte_id:)
        karte = load_own_karte.call(viewer_account_id: viewer_account_id, karte_id: karte_id, require_open: true)
        raise Errors::Invalid, "Rating required to close" if karte.rating.nil?

        closed = karte_repo.close(karte.id)
        present_kartes.call(kartes: [closed], viewer_account_id: viewer_account_id).first
      end
    end
  end
end
