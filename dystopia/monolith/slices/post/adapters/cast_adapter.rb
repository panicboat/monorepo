# frozen_string_literal: true

module Post
  module Adapters
    # Anti-Corruption Layer for checking cast existence from the Profile slice.
    class CastAdapter
      CastInfo = Data.define(:user_id)

      def find_by_user_id(user_id)
        casts = get_by_user_ids_query.call(user_ids: [user_id])
        return nil if casts.empty?

        CastInfo.new(user_id: casts.first.user_id)
      end

      private

      def get_by_user_ids_query
        @get_by_user_ids_query ||= Profile::Slice["use_cases.cast.queries.get_by_user_ids"]
      end
    end
  end
end
