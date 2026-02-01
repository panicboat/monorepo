# frozen_string_literal: true

require "storage"

module Portfolio
  module Presenters
    module Guest
      class ProfilePresenter
        class << self
          def to_proto(guest)
            return empty_profile unless guest

            avatar_key = guest.respond_to?(:avatar_path) ? guest.avatar_path : nil
            avatar_key = nil if avatar_key.to_s.empty?

            ::Portfolio::V1::GuestProfile.new(
              user_id: guest.user_id.to_s,
              name: guest.name || "",
              avatar_path: avatar_key || "",
              avatar_url: avatar_key ? Storage.download_url(key: avatar_key) : "",
              tagline: guest.respond_to?(:tagline) ? (guest.tagline || "") : "",
              bio: guest.respond_to?(:bio) ? (guest.bio || "") : ""
            )
          end

          private

          def empty_profile
            ::Portfolio::V1::GuestProfile.new(
              user_id: "",
              name: "",
              avatar_path: "",
              avatar_url: "",
              tagline: "",
              bio: ""
            )
          end
        end
      end
    end
  end
end
