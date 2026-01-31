# frozen_string_literal: true

require "storage"

module Portfolio
  module Presenters
    module Cast
      class ProfilePresenter
        def self.to_proto(cast, areas: [], genres: [], is_online: false)
          return nil unless cast

          avatar_key = cast.respond_to?(:avatar_path) ? cast.avatar_path : nil
          avatar_key = nil if avatar_key.to_s.empty?

          ::Portfolio::V1::CastProfile.new(
            user_id: cast.user_id.to_s,
            handle: cast.respond_to?(:handle) ? (cast.handle || "") : "",
            name: cast.name,
            bio: cast.bio,
            tagline: cast.tagline,
            default_schedule_start: cast.default_schedule_start,
            default_schedule_end: cast.default_schedule_end,
            image_url: Storage.download_url(key: cast.image_path),
            image_path: cast.image_path,
            avatar_path: avatar_key || "",
            avatar_url: Storage.download_url(key: avatar_key || cast.image_path),
            visibility: visibility_to_enum(cast.visibility),
            images: (cast.images || []).to_a,
            social_links: social_links_to_proto(cast.social_links),
            age: cast.age || 0,
            height: cast.height || 0,
            blood_type: cast.blood_type || "",
            three_sizes: three_sizes_to_proto(cast.three_sizes),
            tags: (cast.tags || []).to_a,
            areas: areas.map { |a| area_to_proto(a) },
            genres: genres.map { |g| genre_to_proto(g) },
            is_online: is_online
          )
        end

        def self.area_to_proto(area)
          return nil unless area

          ::Portfolio::V1::Area.new(
            id: area.id.to_s,
            prefecture: area.prefecture || "",
            name: area.name || "",
            code: area.code || ""
          )
        end

        def self.genre_to_proto(genre)
          return nil unless genre

          ::Portfolio::V1::Genre.new(
            id: genre.id.to_s,
            name: genre.name || "",
            slug: genre.slug || "",
            display_order: genre.display_order || 0
          )
        end

        def self.visibility_to_enum(str)
          case str
          when "unregistered" then :CAST_VISIBILITY_UNREGISTERED
          when "unpublished" then :CAST_VISIBILITY_UNPUBLISHED
          when "published" then :CAST_VISIBILITY_PUBLISHED
          else :CAST_VISIBILITY_UNSPECIFIED
          end
        end

        def self.visibility_from_enum(enum_val)
          case enum_val
          when :CAST_VISIBILITY_UNREGISTERED then "unregistered"
          when :CAST_VISIBILITY_UNPUBLISHED then "unpublished"
          when :CAST_VISIBILITY_PUBLISHED then "published"
          else "unregistered"
          end
        end

        def self.social_links_to_proto(hash)
          return nil unless hash

          ::Portfolio::V1::SocialLinks.new(
            x: hash["x"] || "",
            instagram: hash["instagram"] || "",
            tiktok: hash["tiktok"] || "",
            cityheaven: hash["cityheaven"] || "",
            litlink: hash["litlink"] || "",
            others: hash["others"] || []
          )
        end

        def self.social_links_from_proto(proto)
          return nil unless proto

          {
            "x" => proto.x.to_s,
            "instagram" => proto.instagram.to_s,
            "tiktok" => proto.tiktok.to_s,
            "cityheaven" => proto.cityheaven.to_s,
            "litlink" => proto.litlink.to_s,
            "others" => proto.others.to_a
          }.compact
        end

        def self.three_sizes_to_proto(hash)
          return nil unless hash

          ::Portfolio::V1::ThreeSizes.new(
            bust: hash["bust"] || 0,
            waist: hash["waist"] || 0,
            hip: hash["hip"] || 0,
            cup: hash["cup"] || ""
          )
        end

        def self.three_sizes_from_proto(proto)
          return nil unless proto
          return nil if proto.bust.zero? && proto.waist.zero? && proto.hip.zero? && proto.cup.to_s.empty?

          {
            "bust" => proto.bust,
            "waist" => proto.waist,
            "hip" => proto.hip,
            "cup" => proto.cup.to_s
          }
        end
      end
    end
  end
end
