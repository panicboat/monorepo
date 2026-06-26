# frozen_string_literal: true

require "spec_helper"

RSpec.describe Identity::UseCases::Auth::Login do
  let(:use_case) { described_class.new(repo: repo, refresh_repo: refresh_repo) }
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
          role: role,
          failed_login_attempts: 0,
          locked_until: nil
        )
      end

      before do
        allow(repo).to receive(:find_by_phone_number).with(phone_number).and_return(user)
        allow(repo).to receive(:reset_login_attempts)
      end

      it "returns access token and profile" do
        result = use_case.call(phone_number: phone_number, password: password, role: role)

        expect(result[:access_token]).not_to be_nil
        expect(result[:account][:id]).to eq("user-123")
      end

      it "resets failed login counter on success" do
        expect(repo).to receive(:reset_login_attempts).with("user-123")
        use_case.call(phone_number: phone_number, password: password, role: role)
      end
    end

    context "when password does not match" do
      let(:user) do
        double(
          :user,
          id: "user-123",
          phone_number: phone_number,
          password_digest: BCrypt::Password.create("wrong_password"),
          role: role,
          failed_login_attempts: 0,
          locked_until: nil
        )
      end

      before do
        allow(repo).to receive(:find_by_phone_number).with(phone_number).and_return(user)
        allow(repo).to receive(:record_failed_login)
      end

      it "returns nil" do
        result = use_case.call(phone_number: phone_number, password: password, role: role)
        expect(result).to be_nil
      end

      it "records the failed attempt" do
        expect(repo).to receive(:record_failed_login).with("user-123")
        use_case.call(phone_number: phone_number, password: password, role: role)
      end
    end

    context "when password does not match and the failure count hits the limit" do
      let(:user) do
        double(
          :user,
          id: "user-123",
          phone_number: phone_number,
          password_digest: BCrypt::Password.create("wrong_password"),
          role: role,
          failed_login_attempts: 4,
          locked_until: nil
        )
      end

      before do
        allow(repo).to receive(:find_by_phone_number).with(phone_number).and_return(user)
        allow(repo).to receive(:record_failed_login)
        allow(repo).to receive(:lock_until)
      end

      it "locks the account" do
        expect(repo).to receive(:lock_until).with("user-123", kind_of(Time))
        result = use_case.call(phone_number: phone_number, password: password, role: role)
        expect(result).to be_nil
      end
    end

    context "when the account is currently locked" do
      let(:user) do
        double(
          :user,
          id: "user-123",
          phone_number: phone_number,
          password_digest: BCrypt::Password.create(password),
          role: role,
          failed_login_attempts: 5,
          locked_until: Time.now + 600
        )
      end

      before do
        allow(repo).to receive(:find_by_phone_number).with(phone_number).and_return(user)
      end

      it "returns nil without checking the password" do
        expect(BCrypt::Password).not_to receive(:new)
        result = use_case.call(phone_number: phone_number, password: password, role: role)
        expect(result).to be_nil
      end
    end

    context "when user not found" do
      before do
        allow(repo).to receive(:find_by_phone_number).with(phone_number).and_return(nil)
      end

      it "returns nil" do
        result = use_case.call(phone_number: phone_number, password: password, role: role)
        expect(result).to be_nil
      end
    end
  end
end
