# frozen_string_literal: true

module Karte
  module UseCases
    class UpdateKarteRating
      include Karte::Deps[
        karte_repo: "repositories.karte_repository",
        load_own_karte: "use_cases.load_own_karte",
        present_kartes: "use_cases.present_kartes"
      ]

      def call(viewer_account_id:, karte_id:, rating:)
        karte = load_own_karte.call(viewer_account_id: viewer_account_id, karte_id: karte_id, require_open: true)
        raise Errors::Invalid, "Rating must be 1..5" unless rating.nil? || (1..5).cover?(rating)

        updated = karte_repo.update_rating(karte.id, rating)
        present_kartes.call(kartes: [updated], viewer_account_id: viewer_account_id).first
      end
    end
  end
end
