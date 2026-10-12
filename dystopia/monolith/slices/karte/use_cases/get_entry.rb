# frozen_string_literal: true

module Karte
  module UseCases
    class GetEntry
      include Karte::Deps[entry_repo: "repositories.entry_repository", entry_presenter: "presenters.entry_presenter", authorize_cast_access: "use_cases.authorize_cast_access"]

      def call(viewer_account_id:, entry_id:)
        raise Domain::Errors::Access, "カルテはキャストだけが利用できます" unless authorize_cast_access.call(viewer_account_id: viewer_account_id)
        raise Domain::Errors::Validation, "カルテIDが正しくありません" unless MutateEntry::UUID_FORMAT.match?(entry_id.to_s)

        entry = entry_repo.find_by_id(entry_id)
        raise Domain::Errors::NotFound, "カルテが見つかりません" unless entry

        entry_presenter.call(entries: [entry], viewer_account_id: viewer_account_id, include_events: true).first
      end
    end
  end
end
