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
    let(:profile_media_id) { SecureRandom.uuid }
    let(:avatar_media_id) { SecureRandom.uuid }
    let(:gallery_media_id1) { SecureRandom.uuid }
    let(:gallery_media_id2) { SecureRandom.uuid }
    let(:cast) do
      double(
        :cast,
        id: 1,
        user_id: 123,
        slug: "test_cast",
        name: "Test Cast",
        bio: "Test Bio",
        tagline: "Test Tagline",
        default_schedule_start: "18:00",
        default_schedule_end: "23:00",
        profile_media_id: profile_media_id,
        avatar_media_id: avatar_media_id,
        visibility: "published",
        social_links: { "x" => "@test", "instagram" => "test_ig" },
        age: 25,
        height: 165,
        blood_type: "A",
        three_sizes: { "bust" => 88, "waist" => 60, "hip" => 90, "cup" => "D" },
        tags: %w[model bilingual],
        cast_gallery_media: [
          double(media_id: gallery_media_id1, position: 0),
          double(media_id: gallery_media_id2, position: 1)
        ]
      )
    end

    let(:media_files) do
      {
        profile_media_id => double(url: "http://example.com/profile.jpg"),
        avatar_media_id => double(url: "http://example.com/avatar.jpg"),
        gallery_media_id1 => double(url: "http://example.com/gallery1.jpg"),
        gallery_media_id2 => double(url: "http://example.com/gallery2.jpg")
      }
    end

    it "returns nil when cast is nil" do
      expect(described_class.to_proto(nil)).to be_nil
    end

    it "converts cast to proto with physical attributes" do
      proto = described_class.to_proto(cast, media_files: media_files)

      expect(proto).to be_a(::Portfolio::V1::CastProfile)
      expect(proto.age).to eq(25)
      expect(proto.height).to eq(165)
      expect(proto.blood_type).to eq("A")
      expect(proto.tags).to eq(%w[model bilingual])
    end

    it "converts three_sizes to proto" do
      proto = described_class.to_proto(cast, media_files: media_files)

      expect(proto.three_sizes).to be_a(::Portfolio::V1::ThreeSizes)
      expect(proto.three_sizes.bust).to eq(88)
      expect(proto.three_sizes.waist).to eq(60)
      expect(proto.three_sizes.hip).to eq(90)
      expect(proto.three_sizes.cup).to eq("D")
    end

    it "generates URLs from media_files" do
      proto = described_class.to_proto(cast, media_files: media_files)

      expect(proto.image_url).to eq("http://example.com/profile.jpg")
      expect(proto.avatar_url).to eq("http://example.com/avatar.jpg")
      expect(proto.images).to eq(["http://example.com/gallery1.jpg", "http://example.com/gallery2.jpg"])
    end

    it "includes media_ids in proto" do
      proto = described_class.to_proto(cast, media_files: media_files)

      expect(proto.profile_media_id).to eq(profile_media_id)
      expect(proto.avatar_media_id).to eq(avatar_media_id)
      expect(proto.gallery_media_ids).to eq([gallery_media_id1, gallery_media_id2])
    end

    context "when optional fields are nil" do
      let(:cast_with_nils) do
        double(
          :cast,
          id: 2,
          user_id: 123,
          slug: nil,
          name: "Test Cast",
          bio: nil,
          tagline: nil,
          default_schedule_start: nil,
          default_schedule_end: nil,
          profile_media_id: nil,
          avatar_media_id: nil,
          visibility: "unregistered",
          social_links: nil,
          age: nil,
          height: nil,
          blood_type: nil,
          three_sizes: nil,
          tags: nil,
          cast_gallery_media: nil
        )
      end

      it "handles nil values with defaults" do
        proto = described_class.to_proto(cast_with_nils, media_files: {})

        expect(proto.age).to eq(0)
        expect(proto.height).to eq(0)
        expect(proto.blood_type).to eq("")
        expect(proto.three_sizes).to be_nil
        expect(proto.tags).to eq([])
        expect(proto.image_url).to eq("")
        expect(proto.avatar_url).to eq("")
        expect(proto.images).to eq([])
      end
    end
  end
end
