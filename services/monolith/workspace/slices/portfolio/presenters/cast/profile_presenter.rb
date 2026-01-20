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
            status: status_to_enum(cast.status),
            promise_rate: cast.promise_rate,
            images: (cast.images || []).to_a,
            social_links: social_links_to_proto(cast.social_links)
          )
        end

        def self.status_to_enum(str)
          case str
          when "offline" then :CAST_STATUS_OFFLINE
          when "asking" then :CAST_STATUS_ASKING
          when "online" then :CAST_STATUS_ONLINE
          when "tonight" then :CAST_STATUS_TONIGHT
          else :CAST_STATUS_UNSPECIFIED
          end
        end

        def self.status_from_enum(enum_val)
          case enum_val
          when :CAST_STATUS_OFFLINE then "offline"
          when :CAST_STATUS_ASKING then "asking"
          when :CAST_STATUS_ONLINE then "online"
          when :CAST_STATUS_TONIGHT then "tonight"
          else "offline"
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
