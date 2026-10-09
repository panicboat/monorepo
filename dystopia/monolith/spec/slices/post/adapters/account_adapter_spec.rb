# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Post::Adapters::AccountAdapter", type: :database do
  let(:adapter) { Hanami.app.slices[:post]["adapters.account_adapter"] }

  describe "#profile_exists?" do
    context "when profile exists" do
      it "returns true" do
        profile_id = create_account_with_profile
        expect(adapter.profile_exists?(profile_id)).to be true
      end
    end

    context "when profile does not exist" do
      it "returns false" do
        expect(adapter.profile_exists?(SecureRandom.uuid_v7)).to be false
      end
    end
  end

  describe "#get_user_type" do
    it "returns 'guest' for role 1" do
      profile_id = create_account_with_profile(role: 1)
      expect(adapter.get_user_type(profile_id)).to eq("guest")
    end

    it "returns 'cast' for role 2" do
      profile_id = create_account_with_profile(role: 2)
      expect(adapter.get_user_type(profile_id)).to eq("cast")
    end

    it "returns nil for non-existent user" do
      expect(adapter.get_user_type(SecureRandom.uuid_v7)).to be_nil
    end
  end

  describe "#get_user_types_batch" do
    it "returns user types for multiple users" do
      guest_id = create_account_with_profile(role: 1)
      cast_id = create_account_with_profile(role: 2)

      result = adapter.get_user_types_batch([guest_id, cast_id])
      expect(result[guest_id]).to eq("guest")
      expect(result[cast_id]).to eq("cast")
    end

    it "returns empty hash for empty input" do
      expect(adapter.get_user_types_batch([])).to eq({})
      expect(adapter.get_user_types_batch(nil)).to eq({})
    end
  end
end
