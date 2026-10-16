# frozen_string_literal: true

require "spec_helper"

RSpec.describe Karte::UseCases::AuthorizeCast, type: :database do
  subject(:authorize) { described_class.new }

  it "allows a cast account" do
    expect(authorize.call(viewer_account_id: create_account(role: 2))).to be true
  end

  it "refuses a guest account" do
    expect(authorize.call(viewer_account_id: create_account(role: 1))).to be false
  end

  it "refuses an unknown account" do
    expect(authorize.call(viewer_account_id: SecureRandom.uuid_v7)).to be false
  end
end
