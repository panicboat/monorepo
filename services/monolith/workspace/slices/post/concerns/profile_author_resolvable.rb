# frozen_string_literal: true

module Post
  module Concerns
    # Lazy-memoized accessor for the unified ProfileAuthorAdapter (symmetric / account-based).
    # Mix into post handlers and use_cases that resolve author info via the Profile slice
    # to avoid copy-pasting the same 3-line accessor in every consumer.
    module ProfileAuthorResolvable
      private

      def profile_author_adapter
        @profile_author_adapter ||= Post::Adapters::ProfileAuthorAdapter.new
      end
    end
  end
end
