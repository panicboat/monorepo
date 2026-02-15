# frozen_string_literal: true

require "storage"

module Portfolio
  module Presenters
    module Guest
      class DetailPresenter
        class << self
          def to_proto(guest, is_following:, followed_at:, is_blocked:)
            return empty_profile unless guest

            avatar_key = guest.respond_to?(:avatar_path) ? guest.avatar_path : nil
            avatar_key = nil if avatar_key.to_s.empty?

            ::Portfolio::V1::GuestDetailProfile.new(
              id: guest.id.to_s,
              user_id: guest.user_id.to_s,
              name: guest.name || "",
              avatar_path: avatar_key || "",
              avatar_url: avatar_key ? Storage.download_url(key: avatar_key) : "",
              tagline: guest.respond_to?(:tagline) ? (guest.tagline || "") : "",
              bio: guest.respond_to?(:bio) ? (guest.bio || "") : "",
              is_following: is_following,
              followed_at: followed_at ? followed_at.iso8601 : "",
              is_blocked: is_blocked
            )
          end

          private

          def empty_profile
            ::Portfolio::V1::GuestDetailProfile.new(
              id: "",
              user_id: "",
              name: "",
              avatar_path: "",
              avatar_url: "",
              tagline: "",
              bio: "",
              is_following: false,
              followed_at: "",
              is_blocked: false
            )
          end
        end
      end
    end
  end
end
