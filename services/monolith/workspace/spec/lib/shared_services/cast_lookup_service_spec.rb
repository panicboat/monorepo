# frozen_string_literal: true

require "spec_helper"
require "shared_services/cast_lookup_service"

RSpec.describe SharedServices::CastLookupService do
  let(:cast_repository) { double(:cast_repository) }
  let(:service) { described_class.new(cast_repository: cast_repository) }

  let(:mock_cast) do
    double(
      :cast,
      id: "cast-123",
      user_id: "user-456",
      name: "Test Cast",
      handle: "testcast"
    )
  end

  describe "#find_by_user_id" do
    it "delegates to repository and returns cast" do
      expect(cast_repository).to receive(:find_by_user_id).with("user-456").and_return(mock_cast)

      result = service.find_by_user_id("user-456")

      expect(result).to eq(mock_cast)
    end

    it "returns nil when cast not found" do
      expect(cast_repository).to receive(:find_by_user_id).with("nonexistent").and_return(nil)

      result = service.find_by_user_id("nonexistent")

      expect(result).to be_nil
    end
  end

  describe "#find_by_handle" do
    it "delegates to repository and returns cast with plans/schedules" do
      expect(cast_repository).to receive(:find_by_handle).with("testcast").and_return(mock_cast)

      result = service.find_by_handle("testcast")

      expect(result).to eq(mock_cast)
    end

    it "returns nil when handle not found" do
      expect(cast_repository).to receive(:find_by_handle).with("unknown").and_return(nil)

      result = service.find_by_handle("unknown")

      expect(result).to be_nil
    end
  end
end
