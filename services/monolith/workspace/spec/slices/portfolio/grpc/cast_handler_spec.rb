# frozen_string_literal: true

require "spec_helper"
require "lib/current"
require "slices/portfolio/grpc/cast_handler"

RSpec.describe Portfolio::Grpc::CastHandler do
  let(:handler) {
    described_class.new(
      method_key: :test,
      service: double,
      rpc_desc: double,
      active_call: double,
      message: message,
      get_profile_uc: get_profile_uc,
      save_profile_uc: save_profile_uc,
      publish_uc: publish_uc,
      save_images_uc: save_images_uc,
      list_casts_uc: list_casts_uc,
      repo: repo,
      area_repo: area_repo,
      genre_repo: genre_repo
    )
  }
  let(:message) { double(:message) }
  let(:current_user_id) { 1 }

  # Mocks for dependencies
  let(:get_profile_uc) { double(:get_profile_uc) }
  let(:save_profile_uc) { double(:save_profile_uc) }
  let(:publish_uc) { double(:publish_uc) }
  let(:save_images_uc) { double(:save_images_uc) }
  let(:list_casts_uc) { double(:list_casts_uc) }
  let(:repo) { double(:repo, find_area_ids: [], find_genre_ids: [], online_cast_ids: [], find_area_and_genre_ids: { area_ids: [], genre_ids: [] }, find_gallery_media_ids: []) }
  let(:area_repo) { double(:area_repo, find_by_ids: []) }
  let(:genre_repo) { double(:genre_repo, find_by_ids: []) }
  let(:media_adapter) { double(:media_adapter, find_by_ids: {}) }

  before do
    allow(Current).to receive(:user_id).and_return(current_user_id)
    allow_any_instance_of(described_class).to receive(:media_adapter).and_return(media_adapter)
  end

  let(:profile_media_id) { SecureRandom.uuid }
  let(:avatar_media_id) { SecureRandom.uuid }
  let(:mock_cast_entity) do
    double(
      "CastWithPlans",
      id: 123,
      user_id: 1,
      name: "Cast Name",
      bio: "Bio",
      tagline: "Tagline",
      default_schedules: [{ "start" => "10:00", "end" => "15:00" }, { "start" => "18:00", "end" => "23:00" }],
      profile_media_id: profile_media_id,
      avatar_media_id: avatar_media_id,
      visibility: "public",
      plans: [],
      cast_gallery_media: [],
      social_links: nil,
      age: 25,
      height: 165,
      blood_type: "A",
      three_sizes: { "bust" => 88, "waist" => 60, "hip" => 90, "cup" => "D" },
      tags: %w[model bilingual]
    )
  end

  describe "#create_cast_profile" do
    let(:message) do
      ::Portfolio::V1::CreateCastProfileRequest.new(
        name: "New Name",
        bio: "Bio"
      )
    end

    it "calls operation and returns valid proto" do
      expect(save_profile_uc).to receive(:call).with(hash_including(
        user_id: 1,
        name: "New Name",
        bio: "Bio"
      )).and_return(mock_cast_entity)

      response = handler.create_cast_profile
      expect(response).to be_a(::Portfolio::V1::CreateCastProfileResponse)
      expect(response.profile.name).to eq("Cast Name")
    end

    it "raises unauthenticated when no user" do
      allow(Current).to receive(:user_id).and_return(nil)
      expect { handler.create_cast_profile }.to raise_error(GRPC::BadStatus) { |e| expect(e.code).to eq(GRPC::Core::StatusCodes::UNAUTHENTICATED) }
    end
  end

  describe "#save_cast_profile" do
    let(:message) do
      ::Portfolio::V1::SaveCastProfileRequest.new(name: "Updated Name", bio: "Updated Bio")
    end

    it "calls operation and returns valid proto" do
      expect(save_profile_uc).to receive(:call).with(hash_including(
        user_id: 1,
        name: "Updated Name",
        bio: "Updated Bio"
      )).and_return(mock_cast_entity)

      response = handler.save_cast_profile
      expect(response).to be_a(::Portfolio::V1::SaveCastProfileResponse)
    end

    context "with physical attributes" do
      let(:message) do
        ::Portfolio::V1::SaveCastProfileRequest.new(
          name: "Updated Name",
          age: 25,
          height: 165,
          blood_type: "A",
          three_sizes: ::Portfolio::V1::ThreeSizes.new(bust: 88, waist: 60, hip: 90, cup: "D"),
          tags: %w[model bilingual]
        )
      end

      it "passes physical attributes to use case" do
        expect(save_profile_uc).to receive(:call).with(hash_including(
          user_id: 1,
          name: "Updated Name",
          age: 25,
          height: 165,
          blood_type: "A",
          tags: %w[model bilingual]
        )).and_return(mock_cast_entity)

        response = handler.save_cast_profile
        expect(response).to be_a(::Portfolio::V1::SaveCastProfileResponse)
        expect(response.profile.age).to eq(25)
        expect(response.profile.height).to eq(165)
        expect(response.profile.blood_type).to eq("A")
        expect(response.profile.three_sizes.bust).to eq(88)
        expect(response.profile.tags).to eq(%w[model bilingual])
      end
    end
  end

  # Note: save_cast_plans and save_cast_schedules moved to Offer slice

  describe "#save_cast_images" do
    let(:new_profile_media_id) { SecureRandom.uuid }
    let(:gallery_media_id1) { SecureRandom.uuid }
    let(:gallery_media_id2) { SecureRandom.uuid }
    let(:message) do
      ::Portfolio::V1::SaveCastImagesRequest.new(
        profile_media_id: new_profile_media_id,
        gallery_media_ids: [gallery_media_id1, gallery_media_id2]
      )
    end

    it "calls operation and returns response" do
      allow(get_profile_uc).to receive(:call).with(user_id: 1).and_return(mock_cast_entity)
      expect(save_images_uc).to receive(:call).with(
        cast_id: 123,
        profile_media_id: new_profile_media_id,
        gallery_media_ids: [gallery_media_id1, gallery_media_id2],
        avatar_media_id: nil
      ).and_return(mock_cast_entity)

      response = handler.save_cast_images
      expect(response).to be_a(::Portfolio::V1::SaveCastImagesResponse)
    end
  end

  describe "#get_cast_profile" do
    let(:message) { ::Portfolio::V1::GetCastProfileRequest.new(user_id: "1") }

    it "delegates to operation and maps result" do
      expect(get_profile_uc).to receive(:call).with(user_id: "1").and_return(mock_cast_entity)

      response = handler.get_cast_profile
      expect(response).to be_a(::Portfolio::V1::GetCastProfileResponse)
      expect(response.profile.name).to eq("Cast Name")
    end

    it "raises Not Found when operation returns nil" do
      expect(get_profile_uc).to receive(:call).with(user_id: "1").and_return(nil)
      expect(get_profile_uc).to receive(:call).with(id: "1").and_return(nil)
      expect { handler.get_cast_profile }.to raise_error(GRPC::BadStatus) { |e| expect(e.code).to eq(GRPC::Core::StatusCodes::NOT_FOUND) }
    end
  end

  describe "#list_casts" do
    let(:message) { ::Portfolio::V1::ListCastsRequest.new(visibility_filter: :CAST_VISIBILITY_PUBLIC) }

    it "delegates to operation and returns list" do
      expect(list_casts_uc).to receive(:call).with(hash_including(visibility_filter: "public")).and_return({ casts: [mock_cast_entity], next_cursor: nil, has_more: false })

      response = handler.list_casts
      expect(response).to be_a(::Portfolio::V1::ListCastsResponse)
      expect(response.items.size).to eq(1)
      expect(response.items.first.profile.name).to eq("Cast Name")
    end
  end

  # Note: get_upload_url removed - use MediaService.GetUploadUrl instead
end
