# frozen_string_literal: true

require "spec_helper"
require "slices/identity/operations/login"

RSpec.describe Identity::Operations::Login do
  let(:service) { described_class.new(repo: repo, refresh_repo: refresh_repo) }
  let(:repo) { double(:user_repository) }
  let(:refresh_repo) { double(:refresh_token_repository) }

  before do
    allow(refresh_repo).to receive(:create)
  end

  describe "#call" do
    let(:phone_number) { "+1234567890" }
    let(:password) { "password" }
    let(:role) { 1 }

    context "when credentials are valid" do
      let(:user) do
        double(
          :user,
          id: "user-123",
          phone_number: phone_number,
          password_digest: BCrypt::Password.create(password),
          role: role
        )
      end

      before do
        allow(repo).to receive(:find_by_phone_number).with(phone_number).and_return(user)
      end

      it "returns access token and profile" do
        result = service.call(phone_number: phone_number, password: password, role: role)

        expect(result[:access_token]).not_to be_nil
        expect(result[:user_profile][:id]).to eq("user-123")
      end
    end

    context "when password does not match" do
      let(:user) do
        double(
          :user,
          id: "user-123",
          phone_number: phone_number,
          password_digest: BCrypt::Password.create("wrong_password"),
          role: role
        )
      end

      before do
        allow(repo).to receive(:find_by_phone_number).with(phone_number).and_return(user)
      end

      it "returns nil" do
        result = service.call(phone_number: phone_number, password: password, role: role)
        expect(result).to be_nil
      end
    end

    context "when user not found" do
      before do
        allow(repo).to receive(:find_by_phone_number).with(phone_number).and_return(nil)
      end

      it "returns nil" do
        result = service.call(phone_number: phone_number, password: password, role: role)
        expect(result).to be_nil
      end
    end
  end
end
