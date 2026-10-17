# frozen_string_literal: true

module Karte
  module UseCases
    class GetKarte
      include Karte::Deps[
        karte_repo: "repositories.karte_repository",
        authorize_cast: "use_cases.authorize_cast",
        present_kartes: "use_cases.present_kartes"
      ]

      def call(viewer_account_id:, karte_id:)
        raise Errors::Forbidden, "Cast only" unless authorize_cast.call(viewer_account_id: viewer_account_id)

        karte = Ids.valid?(karte_id) ? karte_repo.find(karte_id) : nil
        raise Errors::Invalid, "Karte not found" unless karte

        present_kartes.call(kartes: [karte], viewer_account_id: viewer_account_id).first
      end
    end
  end
end
