# frozen_string_literal: true

require_relative "media_adapter"

module Post
  module Adapters
    # Resolves post authors via the unified Profile slice (symmetric, account-based).
    class ProfileAuthorAdapter
      AuthorInfo = Data.define(:account_id, :display_name, :username, :avatar_url)

      def initialize
        @get_profile = Profile::Slice["use_cases.get_profile"]
        @media_adapter = MediaAdapter.new
      end

      # account_ids -> { account_id => AuthorInfo }
      def load(account_ids)
        ids = (account_ids || []).compact.uniq
        return {} if ids.empty?

        profiles = ids.filter_map { |aid| @get_profile.call(account_id: aid) }

        avatar_ids = profiles.filter_map { |p| p.avatar_media_id unless p.avatar_media_id.to_s.empty? }
        media = avatar_ids.empty? ? {} : @media_adapter.find_by_ids(avatar_ids)

        profiles.each_with_object({}) do |p, hash|
          mf = media[p.avatar_media_id]
          hash[p.account_id] = AuthorInfo.new(
            account_id: p.account_id.to_s,
            display_name: p.display_name || "",
            username: p.username || "",
            avatar_url: mf&.url || ""
          )
        end
      end
    end
  end
end
