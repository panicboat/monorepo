# frozen_string_literal: true

module Karte
  module UseCases
    class LoadOwnKarte
      include Karte::Deps[
        karte_repo: "repositories.karte_repository",
        authorize_cast: "use_cases.authorize_cast"
      ]

      def call(viewer_account_id:, karte_id:, require_open: false, lock: false)
        raise Errors::Forbidden, "Cast only" unless authorize_cast.call(viewer_account_id: viewer_account_id)

        karte = Ids.valid?(karte_id) ? (lock ? karte_repo.lock(karte_id) : karte_repo.find(karte_id)) : nil
        raise Errors::Invalid, "Karte not found" unless karte
        raise Errors::Forbidden, "Not the author" unless karte.author_account_id == viewer_account_id
        raise Errors::Invalid, "Karte is closed" if require_open && karte.status != "open"

        karte
      end
    end
  end
end
