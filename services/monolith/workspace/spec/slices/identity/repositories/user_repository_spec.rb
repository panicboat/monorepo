# frozen_string_literal: true

require "spec_helper"
require "slices/identity/repositories/user_repository"

RSpec.describe Identity::Repositories::UserRepository, type: :database do
  subject(:repo) { described_class.new }

  describe "#create" do
    it "creates a new user" do
      user = repo.create(
        phone_number: "+1234567890",
        password_digest: "digest",
        role: 1
      )

      expect(user.id).not_to be_nil
      expect(user.phone_number).to eq("+1234567890")
      expect(user.password_digest).to eq("digest")
      expect(user.role).to eq(1)
    end
  end

  describe "#find_by_phone_number" do
    context "when user exists" do
      before do
        repo.create(
          phone_number: "+1234567890",
          password_digest: "digest",
          role: 1
        )
      end

      it "returns the user" do
        user = repo.find_by_phone_number("+1234567890")
        expect(user).not_to be_nil
        expect(user.phone_number).to eq("+1234567890")
      end
    end

    context "when user does not exist" do
      it "returns nil" do
        user = repo.find_by_phone_number("+9999999999")
        expect(user).to be_nil
      end
    end
  end
end
