# frozen_string_literal: true

module Portfolio
  module Presenters
    module Guest
      class DetailPresenter
        class << self
          def to_proto(guest, is_following:, followed_at:, is_blocked:, media_files: {})
            return empty_profile unless guest

            avatar_media = media_files[guest.avatar_media_id]
            avatar_url = avatar_media&.url || ""

            ::Portfolio::V1::GuestDetailProfile.new(
              id: guest.id.to_s,
              user_id: guest.user_id.to_s,
              name: guest.name || "",
              avatar_url: avatar_url,
              avatar_media_id: guest.avatar_media_id || "",
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
              avatar_url: "",
              avatar_media_id: "",
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
