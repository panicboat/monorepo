# frozen_string_literal: true

module Profile
  module Presenters
    class ProfilePresenter
      class << self
        def to_proto(profile, area_records: [], media_files: {}, role: 0)
          return nil unless profile

          ::Profile::V1::Profile.new(
            account_id: profile.account_id.to_s,
            username: profile.username || "",
            display_name: profile.display_name || "",
            bio: profile.bio || "",
            avatar_media_id: profile.avatar_media_id || "",
            avatar_url: media_files[profile.avatar_media_id]&.url || "",
            cover_media_id: profile.cover_media_id || "",
            cover_url: media_files[profile.cover_media_id]&.url || "",
            website: profile.website || "",
            sns_links: sns_links_proto(profile.sns_links),
            prefecture: profile.prefecture || "",
            is_private: profile.is_private ? true : false,
            registered_at: profile.registered_at ? profile.registered_at.iso8601 : "",
            age: profile.age || 0,
            height_cm: profile.height_cm || 0,
            cup_size: profile.cup_size || "",
            industry: profile.industry || "",
            areas: area_records.map { |a| area_to_proto(a) },
            shop_id: profile.shop_id || "",
            role: role || 0
          )
        end

        def area_to_proto(area)
          ::Profile::V1::Area.new(
            id: area.id.to_s,
            region: area.respond_to?(:region) ? (area.region || "") : "",
            prefecture: area.prefecture || "",
            name: area.name || "",
            code: area.code || ""
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
            line: h["line"] || h[:line] || ""
          )
        end
      end
    end
  end
end
