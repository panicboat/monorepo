# frozen_string_literal: true

module Profile
  module Presenters
    class ProfilePresenter
      class << self
        def to_proto(profile, cast: nil, media_files: {}, role: 0, own: false)
          return nil unless profile

          ::Profile::V1::Profile.new(
            id: profile.id.to_s,
            username: profile.username || "",
            display_name: profile.display_name || "",
            bio: profile.bio || "",
            avatar_media_id: profile.avatar_media_id || "",
            avatar_url: media_files[profile.avatar_media_id]&.url || "",
            cover_media_id: profile.cover_media_id || "",
            cover_url: media_files[profile.cover_media_id]&.url || "",
            website: profile.website || "",
            sns_links: sns_links_proto(cast&.sns_links),
            prefecture: profile.prefecture || "",
            is_private: profile.is_private ? true : false,
            registered_at: profile.registered_at ? profile.registered_at.iso8601 : "",
            age: cast&.age || 0,
            body_stats: body_stats_proto(cast&.body_stats),
            industry: cast&.industry || "",
            role: role || 0,
            disabled: own && !profile.disabled_at.nil?
          )
        end

        private

        def sns_links_proto(hash)
          h = hash || {}
          ::Profile::V1::SnsLinks.new(
            x: h["x"] || h[:x] || "",
            instagram: h["instagram"] || h[:instagram] || "",
            tiktok: h["tiktok"] || h[:tiktok] || "",
            bluesky: h["bluesky"] || h[:bluesky] || "",
            line: h["line"] || h[:line] || "",
            cityheaven: h["cityheaven"] || h[:cityheaven] || ""
          )
        end

        def body_stats_proto(hash)
          h = hash || {}
          ::Profile::V1::BodyStats.new(
            height_cm: h["height_cm"] || h[:height_cm] || 0,
            bust_cm: h["bust"] || h[:bust] || 0,
            waist_cm: h["waist"] || h[:waist] || 0,
            hip_cm: h["hip"] || h[:hip] || 0,
            cup: h["cup"] || h[:cup] || ""
          )
        end
      end
    end
  end
end
