# frozen_string_literal: true

require "spec_helper"

RSpec.describe Identity::UseCases::Auth::Register do
  let(:use_case) { described_class.new(repo: repo, verification_repo: verification_repo, refresh_repo: refresh_repo) }
  let(:repo) { double(:user_repository) }
  let(:verification_repo) { double(:sms_verification_repository) }
  let(:refresh_repo) { double(:refresh_token_repository) }

  describe "#call" do
    let(:phone_number) { "+1234567890" }
    let(:password) { "password" }
    let(:verification_token) { "ver-token" }
    let(:role) { 1 }

    context "when verification is valid" do
      let(:verification) do
        double(
          :verification,
          id: verification_token,
          phone_number: phone_number,
          verified_at: Time.now
        )
      end

      let(:user) do
        double(
          :user,
          id: "user-123",
          phone_number: phone_number,
          role: role
        )
      end

      before do
        allow(verification_repo).to receive(:find_by_id).with(verification_token).and_return(verification)
        allow(repo).to receive(:create).and_return(user)
        allow(refresh_repo).to receive(:create)
      end

      it "creates user and returns tokens" do
        result = use_case.call(
          phone_number: phone_number,
          password: password,
          verification_token: verification_token,
          role: role
        )

        expect(result[:access_token]).not_to be_nil
        expect(result[:refresh_token]).not_to be_nil
        expect(result[:user_profile][:id]).to eq("user-123")
      end
    end

    context "when verification token is invalid" do
      before do
        allow(verification_repo).to receive(:find_by_id).with(verification_token).and_return(nil)
      end

      it "raises RegistrationError" do
        expect {
          use_case.call(
            phone_number: phone_number,
            password: password,
            verification_token: verification_token,
            role: role
          )
        }.to raise_error(Identity::UseCases::Auth::Register::RegistrationError, "Invalid verification token")
      end
    end

    context "when phone number does not match" do
      let(:verification) do
        double(
          :verification,
          id: verification_token,
          phone_number: "different-number",
          verified_at: Time.now
        )
      end

      before do
        allow(verification_repo).to receive(:find_by_id).with(verification_token).and_return(verification)
      end

      it "raises RegistrationError" do
        expect {
          use_case.call(
            phone_number: phone_number,
            password: password,
            verification_token: verification_token,
            role: role
          )
        }.to raise_error(Identity::UseCases::Auth::Register::RegistrationError, "Phone number mismatch")
      end
    end
  end
end
