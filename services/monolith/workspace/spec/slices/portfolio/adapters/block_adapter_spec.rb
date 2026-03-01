# frozen_string_literal: true

require "spec_helper"

RSpec.describe Portfolio::Adapters::BlockAdapter do
  let(:adapter) { described_class.new }
  let(:block_repo) { instance_double(Relationship::Repositories::BlockRepository) }

  before do
    allow(Relationship::Slice).to receive(:[]).with("repositories.block_repository").and_return(block_repo)
  end

  describe "#blocked?" do
    it "returns false when guest_user_id is nil" do
      result = adapter.blocked?(guest_user_id: nil, cast_user_id: "cast-123")
      expect(result).to eq(false)
    end

    it "delegates to block_repo.blocked?" do
      allow(block_repo).to receive(:blocked?)
        .with(blocker_id: "guest-123", blocked_id: "cast-456")
        .and_return(true)

      result = adapter.blocked?(guest_user_id: "guest-123", cast_user_id: "cast-456")
      expect(result).to eq(true)
    end
  end

  describe "#cast_blocked_guest?" do
    it "returns false when guest_user_id is nil" do
      result = adapter.cast_blocked_guest?(cast_user_id: "cast-123", guest_user_id: nil)
      expect(result).to eq(false)
    end

    it "returns false when cast_user_id is nil" do
      result = adapter.cast_blocked_guest?(cast_user_id: nil, guest_user_id: "guest-123")
      expect(result).to eq(false)
    end

    it "delegates to block_repo.blocked?" do
      allow(block_repo).to receive(:blocked?)
        .with(blocker_id: "cast-123", blocked_id: "guest-456")
        .and_return(true)

      result = adapter.cast_blocked_guest?(cast_user_id: "cast-123", guest_user_id: "guest-456")
      expect(result).to eq(true)
    end
  end
end
