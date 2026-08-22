# frozen_string_literal: true

require "spec_helper"
require "bcrypt"

RSpec.describe Identity::UseCases::Auth::ResetPassword do
  subject(:use_case) { Identity::Slice["use_cases.auth.reset_password"] }

  let(:user_repo) { Identity::Slice["repositories.user_repository"] }
  let(:verification_repo) { Identity::Slice["repositories.sms_verification_repository"] }
  let(:phone) { "+819011112222" }

  def create_user(password:)
    user_repo.create(
      phone_number: phone,
      password_digest: BCrypt::Password.create(password),
      role: 2
    )
  end

  def verified_token
    v = verification_repo.create(phone_number: phone, code: "123456", expires_at: Time.now + 600)
    verification_repo.mark_as_verified(v.id)
    v.id
  end

  it "updates the password when the verification token is valid" do
    user = create_user(password: "oldpass1")
    token = verified_token

    result = use_case.call(phone_number: phone, new_password: "newpass2", verification_token: token)

    expect(result[:success]).to be true
    reloaded = user_repo.find_by_id(user.id)
    expect(BCrypt::Password.new(reloaded.password_digest)).to eq("newpass2")
  end

  it "rejects an unverified / mismatched token" do
    create_user(password: "oldpass1")
    unverified = verification_repo.create(phone_number: phone, code: "123456", expires_at: Time.now + 600)

    expect {
      use_case.call(phone_number: phone, new_password: "newpass2", verification_token: unverified.id)
    }.to raise_error(Identity::UseCases::Auth::ResetPassword::ResetError)
  end

  it "rejects a token that was already consumed" do
    create_user(password: "oldpass1")
    token = verified_token

    use_case.call(phone_number: phone, new_password: "newpass2", verification_token: token)

    expect {
      use_case.call(phone_number: phone, new_password: "newpass3", verification_token: token)
    }.to raise_error(Identity::UseCases::Auth::ResetPassword::ResetError, "Verification token already used")
  end
end
