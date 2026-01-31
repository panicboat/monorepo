# frozen_string_literal: true

module Presenters
  # Base module for presenter utilities
  # Provides common conversion methods for proto messages
  module Base
    extend self

    # Convert a visibility string to proto enum
    # @param str [String, nil] visibility string ("unregistered", "unpublished", "published")
    # @return [Symbol] proto enum value
    def visibility_to_enum(str)
      case str
      when "unregistered" then :CAST_VISIBILITY_UNREGISTERED
      when "unpublished" then :CAST_VISIBILITY_UNPUBLISHED
      when "published" then :CAST_VISIBILITY_PUBLISHED
      else :CAST_VISIBILITY_UNSPECIFIED
      end
    end

    # Convert a proto visibility enum to string
    # @param enum_val [Symbol] proto enum value
    # @return [String] visibility string
    def visibility_from_enum(enum_val)
      case enum_val
      when :CAST_VISIBILITY_UNREGISTERED then "unregistered"
      when :CAST_VISIBILITY_UNPUBLISHED then "unpublished"
      when :CAST_VISIBILITY_PUBLISHED then "published"
      else "unregistered"
      end
    end

    # Convert social links hash to proto message
    # @param hash [Hash, nil] social links hash
    # @return [Portfolio::V1::SocialLinks, nil] proto message
    def social_links_to_proto(hash)
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

    # Convert proto social links to hash
    # @param proto [Portfolio::V1::SocialLinks, nil] proto message
    # @return [Hash, nil] social links hash
    def social_links_from_proto(proto)
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

    # Convert three sizes hash to proto message
    # @param hash [Hash, nil] three sizes hash
    # @return [Portfolio::V1::ThreeSizes, nil] proto message
    def three_sizes_to_proto(hash)
      return nil unless hash

      ::Portfolio::V1::ThreeSizes.new(
        bust: hash["bust"] || 0,
        waist: hash["waist"] || 0,
        hip: hash["hip"] || 0,
        cup: hash["cup"] || ""
      )
    end

    # Convert proto three sizes to hash
    # @param proto [Portfolio::V1::ThreeSizes, nil] proto message
    # @return [Hash, nil] three sizes hash
    def three_sizes_from_proto(proto)
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
