# frozen_string_literal: true

module Post
  module UseCases
    class ExtractMentions
      MENTION_PATTERN = /(?<![A-Za-z0-9_@])@([A-Za-z0-9_]{3,30})(?![A-Za-z0-9_])/

      def initialize(profile_repo: nil)
        @profile_repo = profile_repo
      end

      def call(content:)
        return [] if content.to_s.empty?

        matches = []
        content.to_s.scan(MENTION_PATTERN) { matches << Regexp.last_match }

        accounts_by_username = matches.map { |match| match[1].downcase }.uniq.each_with_object({}) do |username, hash|
          account = profile_repo.find_by_username(username)
          hash[username] = account if account
        end

        matches.filter_map do |match|
          account = accounts_by_username[match[1].downcase]
          next unless account

          { account_id: account.account_id.to_s, position: match.begin(0), length: match[0].length }
        end
      end

      private

      def profile_repo
        @profile_repo ||= Profile::Slice["repositories.profile_repository"]
      end
    end
  end
end
