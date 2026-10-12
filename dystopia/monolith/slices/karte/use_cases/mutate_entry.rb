# frozen_string_literal: true

module Karte
  module UseCases
    class MutateEntry
      UUID_FORMAT = /\A\h{8}-\h{4}-\h{4}-\h{4}-\h{12}\z/

      include Karte::Deps[entry_repo: "repositories.entry_repository", authorize_cast_access: "use_cases.authorize_cast_access"]

      def call(viewer_account_id:, entry_id:, require_open: true)
        raise Domain::Errors::Access, "カルテはキャストだけが利用できます" unless authorize_cast_access.call(viewer_account_id: viewer_account_id)
        raise Domain::Errors::Validation, "カルテIDが正しくありません" unless UUID_FORMAT.match?(entry_id.to_s)

        entry_repo.locking_entry(entry_id) do |entry|
          raise Domain::Errors::NotFound, "カルテが見つかりません" unless entry
          raise Domain::Errors::Access, "このカルテは所有者だけが変更できます" unless entry.author_account_id == viewer_account_id
          raise Domain::Errors::Conflict, "完了済みのカルテは再オープンしてから変更してください" if require_open && entry.status != "open"

          yield entry
        end
      end
    end
  end
end
