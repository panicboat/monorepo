# frozen_string_literal: true

require "spec_helper"

RSpec.describe Identity::UseCases::User::PurgeIdentity do
  let(:use_case) do
    described_class.new(
      user_repo: user_repo,
      refresh_repo: refresh_repo,
      verification_repo: verification_repo
    )
  end
  let(:user_repo) { double(:user_repository) }
  let(:refresh_repo) { double(:refresh_token_repository) }
  let(:verification_repo) { double(:sms_verification_repository) }
  let(:account_id) { "cast-1" }

  it "deletes refresh tokens, sms verifications (by phone), then the user row" do
    allow(user_repo).to receive(:find_by_id).with(account_id).and_return(
      double(:user, id: account_id, phone_number: "+819000000000")
    )
    expect(refresh_repo).to receive(:delete_by_user_id).with(account_id).ordered
    expect(verification_repo).to receive(:delete_by_phone_number).with("+819000000000").ordered
    expect(user_repo).to receive(:delete).with(account_id).ordered

    use_case.call(account_id: account_id)
  end

  it "is no-op when the user is already gone (idempotent)" do
    allow(user_repo).to receive(:find_by_id).with(account_id).and_return(nil)
    expect(refresh_repo).not_to receive(:delete_by_user_id)
    expect(verification_repo).not_to receive(:delete_by_phone_number)
    expect(user_repo).not_to receive(:delete)
    expect { use_case.call(account_id: account_id) }.not_to raise_error
  end
end
