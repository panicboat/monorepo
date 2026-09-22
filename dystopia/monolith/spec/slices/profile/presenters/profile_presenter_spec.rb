# frozen_string_literal: true

require "spec_helper"
require "profile/v1/service_pb"
require "slices/profile/presenters/profile_presenter"

RSpec.describe Profile::Presenters::ProfilePresenter do
  let(:profile_struct) do
    Struct.new(:account_id, :username, :display_name, :bio, :avatar_media_id, :cover_media_id,
      :website, :prefecture, :is_private, :registered_at)
  end

  let(:cast_struct) do
    Struct.new(:sns_links, :age, :body_stats, :industry)
  end

  describe ".to_proto" do
    it "maps body_stats into a BodyStats proto" do
      profile = profile_struct.new("acc-1", "coco", "Coco", "bio", nil, nil, nil, nil, false, nil)
      cast = cast_struct.new(
        {}, 24, { "height_cm" => 158, "bust" => 88, "waist" => 58, "hip" => 86, "cup" => "D" }, nil
      )

      proto = described_class.to_proto(profile, cast: cast)

      expect(proto.body_stats.height_cm).to eq(158)
      expect(proto.body_stats.bust_cm).to eq(88)
      expect(proto.body_stats.waist_cm).to eq(58)
      expect(proto.body_stats.hip_cm).to eq(86)
      expect(proto.body_stats.cup).to eq("D")
    end

    it "defaults body_stats and age fields to zero/empty when cast is nil" do
      profile = profile_struct.new("acc-1", "coco", "Coco", "bio", nil, nil, nil, nil, false, nil)

      proto = described_class.to_proto(profile, cast: nil)

      expect(proto.body_stats.height_cm).to eq(0)
      expect(proto.body_stats.cup).to eq("")
      expect(proto.age).to eq(0)
    end

    it "maps the cityheaven sns link" do
      profile = profile_struct.new("acc-1", "coco", "Coco", "bio", nil, nil, nil, nil, false, nil)
      cast = cast_struct.new({ "cityheaven" => "https://www.cityheaven.net/example/" }, nil, {}, nil)

      proto = described_class.to_proto(profile, cast: cast)

      expect(proto.sns_links.cityheaven).to eq("https://www.cityheaven.net/example/")
    end

    it "no longer exposes cup_size, height_cm, or shop_id on the proto" do
      expect(::Profile::V1::Profile.descriptor.map(&:name)).not_to include("cup_size", "height_cm", "shop_id")
    end
  end
end
