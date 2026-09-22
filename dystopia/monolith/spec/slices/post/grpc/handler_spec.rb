# frozen_string_literal: true

require "spec_helper"
require "lib/current"
require "slices/post/grpc/handler"

RSpec.describe Post::Grpc::Handler, type: :database do
  let(:handler) do
    described_class.new(
      method_key: :test,
      service: double,
      rpc_desc: double,
      active_call: double,
      message: double(:message)
    )
  end
  let(:block_repo) { Social::Slice["repositories.block_repository"] }

  after { Current.clear }

  describe "#get_blocked_user_ids" do
    it "returns an empty array without a current user" do
      expect(handler.send(:get_blocked_user_ids)).to eq([])
    end

    it "returns ids blocked by the current user, using identity.accounts.role rather than a profile.casts/profile.guests row" do
      blocker_id = SecureRandom.uuid_v7
      blocked_id = SecureRandom.uuid_v7
      block_repo.block(blocker_id: blocker_id, blocked_id: blocked_id)
      Current.user_id = blocker_id

      expect(handler.send(:get_blocked_user_ids)).to contain_exactly(blocked_id)
    end
  end
end
