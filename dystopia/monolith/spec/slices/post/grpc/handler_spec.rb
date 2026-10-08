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

  describe "#get_blocked_profile_ids" do
    it "returns an empty array without a current user" do
      expect(handler.send(:get_blocked_profile_ids)).to eq([])
    end

    it "returns ids blocked by the current user, using identity.accounts.role rather than a profile.casts/profile.guests row" do
      blocker_profile_id = create_account_with_profile
      blocked_profile_id = create_account_with_profile
      block_repo.block(blocker_profile_id: blocker_profile_id, blocked_profile_id: blocked_profile_id)
      Current.account_id = SecureRandom.uuid_v7
      Current.profile_id = blocker_profile_id

      expect(handler.send(:get_blocked_profile_ids)).to contain_exactly(blocked_profile_id)
    end
  end
end
