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

        profiles_by_username = matches.map { |match| match[1].downcase }.uniq.each_with_object({}) do |username, hash|
          profile = profile_repo.find_visible_by_username(username)
          hash[username] = profile if profile
        end

        matches.filter_map do |match|
          profile = profiles_by_username[match[1].downcase]
          next unless profile

          { profile_id: profile.id.to_s, position: match.begin(0), length: match[0].length }
        end
      end

      private

      def profile_repo
        @profile_repo ||= Profile::Slice["repositories.profile_repository"]
      end
    end
  end
end
