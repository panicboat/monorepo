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
end
