# frozen_string_literal: true

require "spec_helper"
require "lib/current"
require "slices/portfolio/grpc/handler"

RSpec.describe Portfolio::Grpc::Handler do
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
      repo: repo
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
  let(:repo) { double(:repo) }

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
      service_category: "category",
      location_type: "type",
      area: "area",
      default_shift_start: "10:00",
      default_shift_end: "20:00",
      image_path: "path/img.jpg",
      status: 'online',
      promise_rate: 1.0,
      cast_plans: [],
      cast_schedules: [],
      images: [],
      social_links: nil
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

  describe "#update_cast_profile" do
    let(:message) do
      ::Portfolio::V1::UpdateCastProfileRequest.new(name: "Updated Name", bio: "Updated Bio")
    end

    it "calls operation and returns valid proto" do
      expect(save_profile_uc).to receive(:call).with(hash_including(
        user_id: 1,
        name: "Updated Name",
        bio: "Updated Bio"
      )).and_return(mock_cast_entity)

      response = handler.update_cast_profile
      expect(response).to be_a(::Portfolio::V1::UpdateCastProfileResponse)
    end
  end

  describe "#update_cast_plans" do
    let(:message) do
      ::Portfolio::V1::UpdateCastPlansRequest.new(
        plans: [::Portfolio::V1::CastPlan.new(name: "P1", price: 1000, duration_minutes: 60)]
      )
    end

    it "calls operation and returns response" do
      allow(get_profile_uc).to receive(:call).with(user_id: 1).and_return(mock_cast_entity)
      expect(save_plans_uc).to receive(:call).with(
        cast_id: 123,
        plans: [{ name: "P1", price: 1000, duration_minutes: 60 }]
      ).and_return(mock_cast_entity)

      response = handler.update_cast_plans
      expect(response).to be_a(::Portfolio::V1::UpdateCastPlansResponse)
    end
  end

  describe "#update_cast_schedules" do
    let(:message) do
      ::Portfolio::V1::UpdateCastSchedulesRequest.new(
        schedules: [::Portfolio::V1::CastSchedule.new(date: "2023-01-01", start_time: "10:00", end_time: "12:00", plan_id: "p1")]
      )
    end

    it "calls operation and returns response" do
      allow(get_profile_uc).to receive(:call).with(user_id: 1).and_return(mock_cast_entity)
      expect(save_schedules_uc).to receive(:call).with(
        cast_id: 123,
        schedules: [{ date: "2023-01-01", start_time: "10:00", end_time: "12:00", plan_id: "p1" }]
      ).and_return(mock_cast_entity)

      response = handler.update_cast_schedules
      expect(response).to be_a(::Portfolio::V1::UpdateCastSchedulesResponse)
    end
  end

  describe "#update_cast_images" do
    let(:message) do
      ::Portfolio::V1::UpdateCastImagesRequest.new(
        profile_image_path: "new/path.jpg",
        gallery_images: ["img1.jpg", "img2.jpg"]
      )
    end

    it "calls operation and returns response" do
      allow(get_profile_uc).to receive(:call).with(user_id: 1).and_return(mock_cast_entity)
      expect(save_images_uc).to receive(:call).with(
        cast_id: 123,
        image_path: "new/path.jpg",
        images: ["img1.jpg", "img2.jpg"]
      ).and_return(mock_cast_entity)

      response = handler.update_cast_images
      expect(response).to be_a(::Portfolio::V1::UpdateCastImagesResponse)
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
    let(:message) { ::Portfolio::V1::ListCastsRequest.new(status_filter: :CAST_STATUS_ONLINE) }

    it "delegates to operation and returns list" do
      expect(list_casts_uc).to receive(:call).with(status_filter: "online").and_return([mock_cast_entity])

      response = handler.list_casts
      expect(response).to be_a(::Portfolio::V1::ListCastsResponse)
      expect(response.items.size).to eq(1)
      expect(response.items.first.profile.name).to eq("Cast Name")
    end
  end

  describe "#update_cast_status" do
    let(:message) { ::Portfolio::V1::UpdateCastStatusRequest.new(status: :CAST_STATUS_OFFLINE) }

    it "delegates to operation after finding cast" do
      expect(get_profile_uc).to receive(:call).with(user_id: 1).and_return(mock_cast_entity)
      expect(publish_uc).to receive(:call).with(cast_id: 123, status: "offline")

      response = handler.update_cast_status
      expect(response).to be_a(::Portfolio::V1::UpdateCastStatusResponse)
    end
  end

  describe "#get_upload_url" do
    let(:message) { ::Portfolio::V1::GetUploadUrlRequest.new(filename: "test.jpg", content_type: "image/jpeg") }

    it "delegates to operation and returns url" do
      success_result = Dry::Monads::Result::Success.call(url: "http://url", key: "key")
      expect(get_upload_url_uc).to receive(:call).with(user_id: 1, filename: "test.jpg", content_type: "image/jpeg").and_return(success_result)

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
