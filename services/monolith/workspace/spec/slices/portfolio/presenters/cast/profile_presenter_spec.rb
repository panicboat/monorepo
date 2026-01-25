# frozen_string_literal: true

require "spec_helper"

RSpec.describe Portfolio::Presenters::Cast::ProfilePresenter do
  describe ".three_sizes_to_proto" do
    it "returns nil when hash is nil" do
      expect(described_class.three_sizes_to_proto(nil)).to be_nil
    end

    it "converts hash to proto" do
      hash = { "bust" => 88, "waist" => 60, "hip" => 90, "cup" => "D" }
      proto = described_class.three_sizes_to_proto(hash)

      expect(proto).to be_a(::Portfolio::V1::ThreeSizes)
      expect(proto.bust).to eq(88)
      expect(proto.waist).to eq(60)
      expect(proto.hip).to eq(90)
      expect(proto.cup).to eq("D")
    end

    it "handles missing values with defaults" do
      hash = { "bust" => 85 }
      proto = described_class.three_sizes_to_proto(hash)

      expect(proto.bust).to eq(85)
      expect(proto.waist).to eq(0)
      expect(proto.hip).to eq(0)
      expect(proto.cup).to eq("")
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

  describe ".to_proto" do
    let(:cast) do
      double(
        :cast,
        user_id: 123,
        name: "Test Cast",
        bio: "Test Bio",
        tagline: "Test Tagline",
        service_category: "standard",
        location_type: "dispatch",
        area: "Tokyo",
        default_schedule_start: "18:00",
        default_schedule_end: "23:00",
        image_path: "path/to/image.jpg",
        visibility: "published",
        promise_rate: 0.95,
        images: %w[img1.jpg img2.jpg],
        social_links: { "x" => "@test", "instagram" => "test_ig" },
        age: 25,
        height: 165,
        blood_type: "A",
        three_sizes: { "bust" => 88, "waist" => 60, "hip" => 90, "cup" => "D" },
        tags: %w[model bilingual]
      )
    end

    before do
      allow(Storage).to receive(:download_url).and_return("http://example.com/image.jpg")
    end

    it "returns nil when cast is nil" do
      expect(described_class.to_proto(nil)).to be_nil
    end

    it "converts cast to proto with physical attributes" do
      proto = described_class.to_proto(cast)

      expect(proto).to be_a(::Portfolio::V1::CastProfile)
      expect(proto.age).to eq(25)
      expect(proto.height).to eq(165)
      expect(proto.blood_type).to eq("A")
      expect(proto.tags).to eq(%w[model bilingual])
    end

    it "converts three_sizes to proto" do
      proto = described_class.to_proto(cast)

      expect(proto.three_sizes).to be_a(::Portfolio::V1::ThreeSizes)
      expect(proto.three_sizes.bust).to eq(88)
      expect(proto.three_sizes.waist).to eq(60)
      expect(proto.three_sizes.hip).to eq(90)
      expect(proto.three_sizes.cup).to eq("D")
    end

    context "when optional fields are nil" do
      let(:cast_with_nils) do
        double(
          :cast,
          user_id: 123,
          name: "Test Cast",
          bio: nil,
          tagline: nil,
          service_category: nil,
          location_type: nil,
          area: nil,
          default_schedule_start: nil,
          default_schedule_end: nil,
          image_path: nil,
          visibility: "unregistered",
          promise_rate: nil,
          images: nil,
          social_links: nil,
          age: nil,
          height: nil,
          blood_type: nil,
          three_sizes: nil,
          tags: nil
        )
      end

      it "handles nil values with defaults" do
        proto = described_class.to_proto(cast_with_nils)

        expect(proto.age).to eq(0)
        expect(proto.height).to eq(0)
        expect(proto.blood_type).to eq("")
        expect(proto.three_sizes).to be_nil
        expect(proto.tags).to eq([])
      end
    end
  end
end
