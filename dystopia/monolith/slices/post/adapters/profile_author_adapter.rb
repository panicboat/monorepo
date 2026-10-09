# frozen_string_literal: true

require_relative "media_adapter"

module Post
  module Adapters
    class ProfileAuthorAdapter
      AuthorInfo = Data.define(:profile_id, :display_name, :username, :avatar_url)

      def initialize
        @get_profile = Profile::Slice["use_cases.get_profile"]
        @media_adapter = MediaAdapter.new
      end

      def load(profile_ids)
        ids = (profile_ids || []).compact.uniq
        return {} if ids.empty?

        profiles = ids.filter_map { |aid| @get_profile.call(profile_id: aid) }

        avatar_ids = profiles.filter_map { |p| p.avatar_media_id unless p.avatar_media_id.to_s.empty? }
        media = avatar_ids.empty? ? {} : @media_adapter.find_by_ids(avatar_ids)

        profiles.each_with_object({}) do |p, hash|
          mf = media[p.avatar_media_id]
          hash[p.id] = AuthorInfo.new(
            profile_id: p.id.to_s,
            display_name: p.display_name || "",
            username: p.username || "",
            avatar_url: mf&.url || ""
          )
        end
      end
    end
  end
end
