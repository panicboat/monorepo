# frozen_string_literal: true

module Portfolio
  module Presenters
    module Guest
      class ProfilePresenter
        class << self
          def to_proto(guest, media_files: {})
            return empty_profile unless guest

            avatar_media = media_files[guest.avatar_media_id]
            avatar_url = avatar_media&.url || ""

            ::Portfolio::V1::GuestProfile.new(
              user_id: guest.user_id.to_s,
              name: guest.name || "",
              avatar_url: avatar_url,
              avatar_media_id: guest.avatar_media_id || "",
              tagline: guest.respond_to?(:tagline) ? (guest.tagline || "") : "",
              bio: guest.respond_to?(:bio) ? (guest.bio || "") : ""
            )
          end

          private

          def empty_profile
            ::Portfolio::V1::GuestProfile.new(
              user_id: "",
              name: "",
              avatar_url: "",
              avatar_media_id: "",
              tagline: "",
              bio: ""
            )
          end
        end
      end
    end
  end
end
