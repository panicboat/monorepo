# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Profile::UseCases::ListVisibleProfiles", type: :database do
  let(:uc) { Profile::Slice["use_cases.list_visible_profiles"] }
  let(:db) { Hanami.app["db.gateway"].connection }

  it "returns the profiles in the requested order" do
    first = create_account_with_profile(username: "first_profile")
    second = create_account_with_profile(username: "second_profile")

    expect(uc.call(profile_ids: [second, first]).map(&:id)).to eq([second, first])
    expect(uc.call(profile_ids: [first, second]).map(&:id)).to eq([first, second])
  end

  it "leaves out disabled, unknown and malformed ids" do
    visible = create_account_with_profile(username: "visible_profile")
    disabled = create_account_with_profile(username: "disabled_profile")
    db[:profile__profiles].where(id: disabled).update(disabled_at: Time.now)

    expect(uc.call(profile_ids: [disabled, visible, SecureRandom.uuid_v7, "not-a-uuid", nil]).map(&:id)).to eq([visible])
  end

  it "leaves out the profiles of a deactivated account" do
    profile = create_account_with_profile(username: "deactivated_profile")
    account_id = db[:profile__profiles].where(id: profile).get(:account_id)
    db[:identity__accounts].where(id: account_id).update(deactivated_at: Time.now)

    expect(uc.call(profile_ids: [profile])).to eq([])
  end

  it "returns one profile per id" do
    profile = create_account_with_profile(username: "repeated_profile")

    expect(uc.call(profile_ids: [profile, profile]).map(&:id)).to eq([profile])
  end

  it "reads every profile in one query" do
    profiles = 3.times.map { |index| create_account_with_profile(username: "batched_#{index}") }
    queries = []
    logger = Object.new
    logger.define_singleton_method(:info) { |sql| queries << sql if sql.include?("FROM \"profile\".\"profiles\"") && sql.include?(" IN (") }
    db.loggers << logger

    uc.call(profile_ids: profiles)

    expect(queries.size).to eq(1)
  ensure
    db.loggers.delete(logger)
  end
end
