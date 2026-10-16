# frozen_string_literal: true

module Karte
  module UseCases
    class DeleteKarte
      include Karte::Deps[
        karte_repo: "repositories.karte_repository",
        load_own_karte: "use_cases.load_own_karte"
      ]

      def call(viewer_account_id:, karte_id:)
        karte = load_own_karte.call(viewer_account_id: viewer_account_id, karte_id: karte_id)
        karte_repo.delete(karte.id)
        nil
      end
    end
  end
end
