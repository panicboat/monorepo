# frozen_string_literal: true

require "securerandom"

module ProfileFixtures
  def create_account(role: 1)
    id = SecureRandom.uuid_v7
    fixture_db[:identity__accounts].insert(id: id, role: role, created_at: Time.now, updated_at: Time.now)
    id
  end

  def create_account_with_profile(role: 1, account_id: nil, **profile_attrs)
    owner_id = account_id || create_account(role: role)
    profile_id = SecureRandom.uuid_v7
    fixture_db[:profile__profiles].insert(
      { id: profile_id, account_id: owner_id, display_name: "User", is_private: false }.merge(profile_attrs)
    )
    profile_id
  end

  private

  def fixture_db
    Hanami.app["db.gateway"].connection
  end
end

RSpec.configure { |config| config.include ProfileFixtures }
