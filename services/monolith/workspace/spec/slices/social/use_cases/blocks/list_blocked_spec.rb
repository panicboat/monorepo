# frozen_string_literal: true

require "spec_helper"

RSpec.describe Social::UseCases::Blocks::ListBlocked do
  let(:use_case) do
    described_class.new(
      block_repo: block_repo,
      cast_adapter: cast_adapter,
      guest_adapter: guest_adapter
    )
  end
  let(:block_repo) { double(:block_repo) }
  let(:cast_adapter) { double(:cast_adapter) }
  let(:guest_adapter) { double(:guest_adapter) }

  let(:blocker_id) { "guest-1" }

  describe "#call" do
    context "when there are blocked users" do
      let(:blocked_cast_id) { "cast-1" }
      let(:blocked_at) { Time.now }
      let(:block_record) do
        double(:block_record,
          blocked_id: blocked_cast_id,
          blocked_type: "cast",
          created_at: blocked_at
        )
      end
      let(:cast_info) do
        double(:cast_info,
          name: "Test Cast",
          avatar_path: "avatars/cast-1.jpg",
          image_path: "images/cast-1.jpg"
        )
      end

      before do
        allow(block_repo).to receive(:list_blocked)
          .with(blocker_id: blocker_id, limit: 50, cursor: nil)
          .and_return({ records: [block_record], has_more: false })
        allow(cast_adapter).to receive(:find_by_id)
          .with(blocked_cast_id)
          .and_return(cast_info)
        allow(Storage).to receive(:download_url)
          .with(key: "avatars/cast-1.jpg")
          .and_return("https://cdn.example.com/avatars/cast-1.jpg")
      end

      it "returns blocked users with user info" do
        result = use_case.call(blocker_id: blocker_id)

        expect(result[:users].size).to eq(1)
        expect(result[:users].first[:id]).to eq(blocked_cast_id)
        expect(result[:users].first[:name]).to eq("Test Cast")
        expect(result[:users].first[:user_type]).to eq("cast")
        expect(result[:has_more]).to be false
      end
    end

    context "when there are no blocked users" do
      before do
        allow(block_repo).to receive(:list_blocked)
          .with(blocker_id: blocker_id, limit: 50, cursor: nil)
          .and_return({ records: [], has_more: false })
      end

      it "returns empty list" do
        result = use_case.call(blocker_id: blocker_id)

        expect(result[:users]).to eq([])
        expect(result[:has_more]).to be false
        expect(result[:next_cursor]).to be_nil
      end
    end

    context "with pagination" do
      it "respects limit parameter" do
        allow(block_repo).to receive(:list_blocked)
          .with(blocker_id: blocker_id, limit: 10, cursor: nil)
          .and_return({ records: [], has_more: false })

        use_case.call(blocker_id: blocker_id, limit: 10)

        expect(block_repo).to have_received(:list_blocked)
          .with(blocker_id: blocker_id, limit: 10, cursor: nil)
      end

      it "enforces max limit of 100" do
        allow(block_repo).to receive(:list_blocked)
          .with(blocker_id: blocker_id, limit: 100, cursor: nil)
          .and_return({ records: [], has_more: false })

        use_case.call(blocker_id: blocker_id, limit: 200)

        expect(block_repo).to have_received(:list_blocked)
          .with(blocker_id: blocker_id, limit: 100, cursor: nil)
      end

      it "enforces min limit of 1" do
        allow(block_repo).to receive(:list_blocked)
          .with(blocker_id: blocker_id, limit: 1, cursor: nil)
          .and_return({ records: [], has_more: false })

        use_case.call(blocker_id: blocker_id, limit: 0)

        expect(block_repo).to have_received(:list_blocked)
          .with(blocker_id: blocker_id, limit: 1, cursor: nil)
      end
    end
  end
end
