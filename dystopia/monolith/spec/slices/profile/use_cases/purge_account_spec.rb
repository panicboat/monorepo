# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Profile::UseCases::PurgeAccount", type: :database do
  let(:uc) { Hanami.app.slices[:profile]["use_cases.purge_account"] }
  let(:repo) { Hanami.app.slices[:profile]["repositories.profile_repository"] }
  let(:cast_repo) { Hanami.app.slices[:profile]["repositories.cast_repository"] }

  it "purges every profile of the account and leaves other accounts" do
    account_id = create_account(role: 2)
    first = create_account_with_profile(account_id: account_id)
    second = create_account_with_profile(account_id: account_id)
    cast_repo.create(profile_id: first)
    cast_repo.create(profile_id: second)
    other = create_account_with_profile(role: 2)
    cast_repo.create(profile_id: other)

    uc.call(account_id: account_id)

    expect(repo.list_by_account(account_id)).to eq([])
    expect(cast_repo.find_by_profile_id(first)).to be_nil
    expect(cast_repo.find_by_profile_id(second)).to be_nil
    expect(repo.find_by_id(other)).not_to be_nil
    expect(cast_repo.find_by_profile_id(other)).not_to be_nil
  end

  it "returns nil" do
    expect(uc.call(account_id: create_account)).to be_nil
  end
end
