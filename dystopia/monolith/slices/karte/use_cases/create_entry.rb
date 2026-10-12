# frozen_string_literal: true

module Karte
  module UseCases
    class CreateEntry
      CreateError = Domain::Errors::Validation
      AccessError = Domain::Errors::Access

      include Karte::Deps[entry_repo: "repositories.entry_repository", event_repo: "repositories.event_repository", authorize_cast_access: "use_cases.authorize_cast_access"]

      def initialize(get_role: nil, **kwargs)
        super(**kwargs)
        @get_role = get_role
      end

      def call(viewer_account_id:, viewer_profile_id:, target_profile_id:, rating: nil, body: nil, first_event:)
        raise AccessError, "カルテはキャストだけが利用できます" unless authorize_cast_access.call(viewer_account_id: viewer_account_id)
        raise CreateError, "最初の出来事を入力してください" unless first_event
        role = get_role.call(profile_id: target_profile_id)
        raise Domain::Errors::NotFound, "対象ゲストが見つかりません" unless role
        raise CreateError, "対象はゲストを選択してください" unless role == 1

        event = Domain::EventRules.validate_event!(first_event)
        memo = body.is_a?(String) && body.empty? ? nil : body
        Domain::EventRules.validate_entry!(rating: rating, body: memo, events: [event])
        entry_repo.transaction(savepoint: true) do
          entry = entry_repo.create(author_account_id: viewer_account_id, author_profile_id: viewer_profile_id, target_profile_id: target_profile_id, rating: rating, body: memo)
          event_repo.create(entry_id: entry.id, input: event)
          entry
        end
      end

      private

      def get_role
        @get_role ||= ::Profile::Slice["use_cases.get_role"]
      end
    end
  end
end
