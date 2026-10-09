# frozen_string_literal: true

require "spec_helper"

RSpec.describe Notifications::UseCases::UpdatePreferences, type: :database do
  let(:update_preferences) { Notifications::Slice["use_cases.update_preferences"] }
  let(:get_preferences) { Notifications::Slice["use_cases.get_preferences"] }
  let(:defaults) { Notifications::UseCases::GetPreferences::DEFAULT_PREFERENCES }
  let(:profile_id) { create_account_with_profile }

  it "stores the preferences of a profile that has none yet" do
    saved = update_preferences.call(profile_id: profile_id, preferences: defaults.merge(like: false))

    expect(saved).to eq(defaults.merge(like: false))
    expect(get_preferences.call(profile_id: profile_id)).to eq(defaults.merge(like: false))
  end

  it "replaces every preference when the profile saves again" do
    update_preferences.call(profile_id: profile_id, preferences: defaults.merge(like: false))
    changed = defaults.transform_values { |value| !value }

    saved = update_preferences.call(profile_id: profile_id, preferences: changed)

    expect(saved).to eq(changed)
    expect(get_preferences.call(profile_id: profile_id)).to eq(changed)
  end

  it "keeps the preferences of another profile" do
    other_profile_id = create_account_with_profile
    update_preferences.call(profile_id: other_profile_id, preferences: defaults.merge(follow: false))

    update_preferences.call(profile_id: profile_id, preferences: defaults.merge(like: false))
    update_preferences.call(profile_id: profile_id, preferences: defaults.merge(reply: false))

    expect(get_preferences.call(profile_id: other_profile_id)).to eq(defaults.merge(follow: false))
  end
end
