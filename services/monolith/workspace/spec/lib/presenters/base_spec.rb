# frozen_string_literal: true

require "spec_helper"
require "presenters/base"

RSpec.describe Presenters::Base do
  describe ".visibility_to_enum" do
    it "converts 'unregistered' to enum" do
      expect(described_class.visibility_to_enum("unregistered")).to eq(:CAST_VISIBILITY_UNREGISTERED)
    end

    it "converts 'unpublished' to enum" do
      expect(described_class.visibility_to_enum("unpublished")).to eq(:CAST_VISIBILITY_UNPUBLISHED)
    end

    it "converts 'published' to enum" do
      expect(described_class.visibility_to_enum("published")).to eq(:CAST_VISIBILITY_PUBLISHED)
    end

    it "returns UNSPECIFIED for unknown values" do
      expect(described_class.visibility_to_enum("unknown")).to eq(:CAST_VISIBILITY_UNSPECIFIED)
      expect(described_class.visibility_to_enum(nil)).to eq(:CAST_VISIBILITY_UNSPECIFIED)
    end
  end

  describe ".visibility_from_enum" do
    it "converts UNREGISTERED enum to string" do
      expect(described_class.visibility_from_enum(:CAST_VISIBILITY_UNREGISTERED)).to eq("unregistered")
    end

    it "converts UNPUBLISHED enum to string" do
      expect(described_class.visibility_from_enum(:CAST_VISIBILITY_UNPUBLISHED)).to eq("unpublished")
    end

    it "converts PUBLISHED enum to string" do
      expect(described_class.visibility_from_enum(:CAST_VISIBILITY_PUBLISHED)).to eq("published")
    end

    it "returns 'unregistered' for unknown values" do
      expect(described_class.visibility_from_enum(:UNKNOWN)).to eq("unregistered")
      expect(described_class.visibility_from_enum(nil)).to eq("unregistered")
    end
  end

  describe ".social_links_to_proto" do
    it "returns nil when hash is nil" do
      expect(described_class.social_links_to_proto(nil)).to be_nil
    end

    it "converts hash to proto message" do
      hash = {
        "x" => "@test",
        "instagram" => "test_ig",
        "tiktok" => "test_tk",
        "cityheaven" => "test_ch",
        "litlink" => "test_ll",
        "others" => ["http://other.com"]
      }

      proto = described_class.social_links_to_proto(hash)

      expect(proto).to be_a(::Portfolio::V1::SocialLinks)
      expect(proto.x).to eq("@test")
      expect(proto.instagram).to eq("test_ig")
      expect(proto.tiktok).to eq("test_tk")
      expect(proto.cityheaven).to eq("test_ch")
      expect(proto.litlink).to eq("test_ll")
      expect(proto.others).to eq(["http://other.com"])
    end

    it "handles missing values with defaults" do
      hash = { "x" => "@test" }
      proto = described_class.social_links_to_proto(hash)

      expect(proto.x).to eq("@test")
      expect(proto.instagram).to eq("")
      expect(proto.tiktok).to eq("")
    end
  end

  describe ".social_links_from_proto" do
    it "returns nil when proto is nil" do
      expect(described_class.social_links_from_proto(nil)).to be_nil
    end

    it "converts proto to hash" do
      proto = ::Portfolio::V1::SocialLinks.new(
        x: "@test",
        instagram: "test_ig",
        tiktok: "",
        cityheaven: "",
        litlink: "",
        others: []
      )

      hash = described_class.social_links_from_proto(proto)

      expect(hash["x"]).to eq("@test")
      expect(hash["instagram"]).to eq("test_ig")
      expect(hash["tiktok"]).to eq("")
    end
  end

  describe ".three_sizes_to_proto" do
    it "returns nil when hash is nil" do
      expect(described_class.three_sizes_to_proto(nil)).to be_nil
    end

    it "converts hash to proto message" do
      hash = { "bust" => 88, "waist" => 60, "hip" => 90, "cup" => "D" }
      proto = described_class.three_sizes_to_proto(hash)

      expect(proto).to be_a(::Portfolio::V1::ThreeSizes)
      expect(proto.bust).to eq(88)
      expect(proto.waist).to eq(60)
      expect(proto.hip).to eq(90)
      expect(proto.cup).to eq("D")
    end
  end

  describe ".three_sizes_from_proto" do
    it "returns nil when proto is nil" do
      expect(described_class.three_sizes_from_proto(nil)).to be_nil
    end

    it "returns nil when all values are zero/empty" do
      proto = ::Portfolio::V1::ThreeSizes.new(bust: 0, waist: 0, hip: 0, cup: "")
      expect(described_class.three_sizes_from_proto(proto)).to be_nil
    end

    it "converts proto to hash" do
      proto = ::Portfolio::V1::ThreeSizes.new(bust: 88, waist: 60, hip: 90, cup: "D")
      hash = described_class.three_sizes_from_proto(proto)

      expect(hash).to eq({
        "bust" => 88,
        "waist" => 60,
        "hip" => 90,
        "cup" => "D"
      })
    end
  end
end
