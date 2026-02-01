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
      save_plans_uc: save_plans_uc,
      save_schedules_uc: save_schedules_uc,
      save_images_uc: save_images_uc,
      get_upload_url_uc: get_upload_url_uc,
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
  let(:save_plans_uc) { double(:save_plans_uc) }
  let(:save_schedules_uc) { double(:save_schedules_uc) }
  let(:save_images_uc) { double(:save_images_uc) }
  let(:get_upload_url_uc) { double(:get_upload_url_uc) }
  let(:list_casts_uc) { double(:list_casts_uc) }
  let(:repo) { double(:repo, find_area_ids: [], find_genre_ids: [], online_cast_ids: []) }
  let(:area_repo) { double(:area_repo, find_by_ids: []) }
  let(:genre_repo) { double(:genre_repo, find_by_ids: []) }

  before do
    allow(Current).to receive(:user_id).and_return(current_user_id)
  end

  let(:mock_cast_entity) do
    double(
      "CastWithPlans",
      id: 123,
      user_id: 1,
      name: "Cast Name",
      bio: "Bio",
      tagline: "Tagline",
      default_schedule_start: "10:00",
      default_schedule_end: "20:00",
      image_path: "path/img.jpg",
      visibility: 'published',
      cast_plans: [],
      cast_schedules: [],
      images: [],
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
        bio: "Bio",
        image_path: "path/img.jpg"
      )
    end

    it "calls operation and returns valid proto" do
      expect(save_profile_uc).to receive(:call).with(hash_including(
        user_id: 1,
        name: "New Name",
        bio: "Bio",
        image_path: "path/img.jpg"
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

  describe "#save_cast_plans" do
    let(:message) do
      ::Portfolio::V1::SaveCastPlansRequest.new(
        plans: [::Portfolio::V1::CastPlan.new(name: "P1", price: 1000, duration_minutes: 60)]
      )
    end

    it "calls operation and returns response" do
      allow(get_profile_uc).to receive(:call).with(user_id: 1).and_return(mock_cast_entity)
      expect(save_plans_uc).to receive(:call).with(
        cast_id: 123,
        plans: [{ name: "P1", price: 1000, duration_minutes: 60 }]
      ).and_return(mock_cast_entity)

      response = handler.save_cast_plans
      expect(response).to be_a(::Portfolio::V1::SaveCastPlansResponse)
    end
  end

  describe "#save_cast_schedules" do
    let(:message) do
      ::Portfolio::V1::SaveCastSchedulesRequest.new(
        schedules: [::Portfolio::V1::CastSchedule.new(date: "2023-01-01", start_time: "10:00", end_time: "12:00", plan_id: "p1")]
      )
    end

    it "calls operation and returns response" do
      allow(get_profile_uc).to receive(:call).with(user_id: 1).and_return(mock_cast_entity)
      expect(save_schedules_uc).to receive(:call).with(
        cast_id: 123,
        schedules: [{ date: "2023-01-01", start_time: "10:00", end_time: "12:00", plan_id: "p1" }]
      ).and_return(mock_cast_entity)

      response = handler.save_cast_schedules
      expect(response).to be_a(::Portfolio::V1::SaveCastSchedulesResponse)
    end
  end

  describe "#save_cast_images" do
    let(:message) do
      ::Portfolio::V1::SaveCastImagesRequest.new(
        profile_image_path: "new/path.jpg",
        gallery_images: ["img1.jpg", "img2.jpg"]
      )
    end

    it "calls operation and returns response" do
      allow(get_profile_uc).to receive(:call).with(user_id: 1).and_return(mock_cast_entity)
      expect(save_images_uc).to receive(:call).with(
        cast_id: 123,
        image_path: "new/path.jpg",
        images: ["img1.jpg", "img2.jpg"],
        avatar_path: nil
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
      expect { handler.get_cast_profile }.to raise_error(GRPC::BadStatus) { |e| expect(e.code).to eq(GRPC::Core::StatusCodes::NOT_FOUND) }
    end
  end

  describe "#list_casts" do
    let(:message) { ::Portfolio::V1::ListCastsRequest.new(visibility_filter: :CAST_VISIBILITY_PUBLISHED) }

    it "delegates to operation and returns list" do
      expect(list_casts_uc).to receive(:call).with(hash_including(visibility_filter: "published")).and_return([mock_cast_entity])

      response = handler.list_casts
      expect(response).to be_a(::Portfolio::V1::ListCastsResponse)
      expect(response.items.size).to eq(1)
      expect(response.items.first.profile.name).to eq("Cast Name")
    end
  end

  describe "#get_upload_url" do
    let(:message) { ::Portfolio::V1::GetUploadUrlRequest.new(filename: "test.jpg", content_type: "image/jpeg") }

    it "delegates to operation and returns url" do
      success_result = Dry::Monads::Result::Success.call(url: "http://url", key: "key")
      expect(get_upload_url_uc).to receive(:call).with(user_id: 1, filename: "test.jpg", content_type: "image/jpeg", prefix: "casts").and_return(success_result)

      response = handler.get_upload_url
      expect(response).to be_a(::Portfolio::V1::GetUploadUrlResponse)
      expect(response.url).to eq("http://url")
    end

    it "handles failure" do
      failure_result = Dry::Monads::Result::Failure.call(:invalid_input)
      expect(get_upload_url_uc).to receive(:call).and_return(failure_result)

      expect { handler.get_upload_url }.to raise_error(GRPC::BadStatus)
    end
  end
end
