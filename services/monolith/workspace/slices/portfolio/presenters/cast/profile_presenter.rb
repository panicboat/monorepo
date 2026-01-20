# frozen_string_literal: true

require "storage"

module Portfolio
  module Presenters
    module Cast
      class ProfilePresenter
        def self.to_proto(cast)
          return nil unless cast

          ::Portfolio::V1::CastProfile.new(
            user_id: cast.user_id.to_s,
            name: cast.name,
            bio: cast.bio,
            tagline: cast.tagline,
            service_category: cast.service_category,
            location_type: cast.location_type,
            area: cast.area,
            default_shift_start: cast.default_shift_start,
            default_shift_end: cast.default_shift_end,
            image_url: Storage.download_url(key: cast.image_path),
            image_path: cast.image_path,
            visibility: visibility_to_enum(cast.visibility),
            promise_rate: cast.promise_rate,
            images: (cast.images || []).to_a,
            social_links: social_links_to_proto(cast.social_links)
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
      end
    end
  end
end
