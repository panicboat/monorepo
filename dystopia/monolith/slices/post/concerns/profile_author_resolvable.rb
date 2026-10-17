# frozen_string_literal: true

module Post
  module Concerns
    module ProfileAuthorResolvable
      private

      def summarize_profiles
        @summarize_profiles ||= ::Profile::Slice["use_cases.summarize_profiles"]
      end
    end
  end
end
