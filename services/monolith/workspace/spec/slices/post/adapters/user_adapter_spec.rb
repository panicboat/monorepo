# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Post::Adapters::UserAdapter", type: :database do
  let(:adapter) { Hanami.app.slices[:post]["adapters.user_adapter"] }
  let(:db) { Hanami.app.slices[:post]["db.rom"].gateways[:default].connection }

  def create_user(role: 1)
    id = SecureRandom.uuid
    db[:identity__users].insert(
      id: id,
      phone_number: "090#{rand(10000000..99999999)}",
      password_digest: "$2a$12$K0ByB.6YI2/OYrB4fQOYLe6Tv0datUVf6VZ/2Jzwm879BW5K1cHey",
      role: role,
      created_at: Time.now,
      updated_at: Time.now
    )
    id
  end

  describe "#user_exists?" do
    context "when user exists" do
      it "returns true" do
        user_id = create_user
        expect(adapter.user_exists?(user_id)).to be true
      end
    end

    context "when user does not exist" do
      it "returns false" do
        expect(adapter.user_exists?(SecureRandom.uuid)).to be false
      end
    end
  end

  describe "#get_user_type" do
    it "returns 'guest' for role 1" do
      user_id = create_user(role: 1)
      expect(adapter.get_user_type(user_id)).to eq("guest")
    end

    it "returns 'cast' for role 2" do
      user_id = create_user(role: 2)
      expect(adapter.get_user_type(user_id)).to eq("cast")
    end

    it "returns nil for non-existent user" do
      expect(adapter.get_user_type(SecureRandom.uuid)).to be_nil
    end
  end

  describe "#get_user_types_batch" do
    it "returns user types for multiple users" do
      guest_id = create_user(role: 1)
      cast_id = create_user(role: 2)

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
