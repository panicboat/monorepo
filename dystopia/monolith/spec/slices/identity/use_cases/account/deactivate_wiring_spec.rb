# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Identity::UseCases::Account::DeactivateAccount wiring", type: :database do
  let(:db) { Hanami.app["db.gateway"].connection }

  it "deactivates an account without billing rows through the real container without calling Stripe" do
    account_id = create_account(role: 1)
    expect(::Stripe::Subscription).not_to receive(:update)

    Identity::Slice["use_cases.account.deactivate_account"].call(sub: account_id)

    expect(db[:identity__accounts].where(id: account_id).get(:deactivated_at)).not_to be_nil
  end
end
