# frozen_string_literal: true

module Portfolio
  module Presenters
    module Cast
      class ProfilePresenter
        def self.to_proto(cast, areas: [], genres: [], is_online: false, media_files: {})
          return nil unless cast

          # Get profile image URL from media_files
          profile_media = media_files[cast.profile_media_id]
          # FALLBACK: Returns empty string when profile media URL is not available
          profile_url = profile_media&.url || ""

          # Get avatar URL from media_files (fallback to profile image)
          avatar_media = media_files[cast.avatar_media_id]
          # FALLBACK: Returns profile URL when avatar media URL is not available
          avatar_url = avatar_media&.url || profile_url

          # Get gallery media URLs
          gallery_urls = gallery_media_urls(cast, media_files)

          ::Portfolio::V1::CastProfile.new(
            id: cast.id.to_s,
            user_id: cast.user_id.to_s,
            slug: cast.respond_to?(:slug) ? (cast.slug || "") : "",
            name: cast.name,
            bio: cast.bio,
            tagline: cast.tagline,
            default_schedule_start: cast.default_schedule_start,
            default_schedule_end: cast.default_schedule_end,
            image_url: profile_url,
            profile_media_id: cast.profile_media_id || "",
            avatar_media_id: cast.avatar_media_id || "",
            avatar_url: avatar_url,
            visibility: visibility_to_enum(cast.visibility),
            gallery_media_ids: gallery_media_ids(cast),
            images: gallery_urls,
            social_links: social_links_to_proto(cast.social_links),
            age: cast.age || 0,
            height: cast.height || 0,
            blood_type: cast.blood_type || "",
            three_sizes: three_sizes_to_proto(cast.three_sizes),
            tags: (cast.tags || []).to_a,
            areas: areas.map { |a| area_to_proto(a) },
            genres: genres.map { |g| genre_to_proto(g) },
            is_online: is_online,
            registered_at: cast.respond_to?(:registered_at) && cast.registered_at ? cast.registered_at.iso8601 : ""
          )
        end

        def self.gallery_media_ids(cast)
          return [] unless cast.respond_to?(:cast_gallery_media)
          return [] unless cast.cast_gallery_media

          cast.cast_gallery_media.sort_by(&:position).map(&:media_id)
        end

        def self.gallery_media_urls(cast, media_files)
          # FALLBACK: Returns empty string for missing gallery media URLs
          gallery_media_ids(cast).map { |id| media_files[id]&.url || "" }
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
          when "public" then :CAST_VISIBILITY_PUBLIC
          when "private" then :CAST_VISIBILITY_PRIVATE
          else :CAST_VISIBILITY_UNSPECIFIED
          end
        end

        def self.visibility_from_enum(enum_val)
          case enum_val
          when :CAST_VISIBILITY_PUBLIC then "public"
          when :CAST_VISIBILITY_PRIVATE then "private"
          else "public"
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
