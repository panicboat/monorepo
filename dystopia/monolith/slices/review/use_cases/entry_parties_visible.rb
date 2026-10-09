# frozen_string_literal: true

module Review
  module UseCases
    class EntryPartiesVisible
      def call(entry:)
        parties = [entry.author_profile_id, entry.target_profile_id]
        list_visible_profile_ids.call(profile_ids: parties).length == parties.length
      end

      private

      def list_visible_profile_ids
        @list_visible_profile_ids ||= ::Profile::Slice["use_cases.list_visible_profile_ids"]
      end
    end
  end
end
