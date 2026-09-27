# frozen_string_literal: true

module Post
  module Concerns
    module ProfileAuthorResolvable
      private

      def profile_author_adapter
        @profile_author_adapter ||= Post::Adapters::ProfileAuthorAdapter.new
      end
    end
  end
end
