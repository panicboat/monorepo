# frozen_string_literal: true

require "spec_helper"
require "errors/validation_error"

RSpec.describe "Profile::UseCases::CreateProfile", type: :database do
  let(:uc) { Hanami.app.slices[:profile]["use_cases.create_profile"] }
  let(:repo) { Hanami.app.slices[:profile]["repositories.profile_repository"] }
  let(:limit_error) { Profile::UseCases::CreateProfile::LimitExceededError }

  context "for a guest account" do
    let(:account_id) { create_account(role: 1) }

    it "creates the first profile with an id that differs from the account id" do
      profile = uc.call(account_id: account_id, display_name: "Taro", username: "taro_01")

      expect(profile.account_id).to eq(account_id)
      expect(profile.id).not_to eq(account_id)
      expect(profile.username).to eq("taro_01")
    end

    it "rejects a second profile" do
      uc.call(account_id: account_id, display_name: "Taro")

      expect { uc.call(account_id: account_id, display_name: "Taro 2") }.to raise_error(limit_error)
    end
  end

  context "for a cast account" do
    let(:account_id) { create_account(role: 2) }

    it "allows up to five profiles and rejects the sixth" do
      5.times { |i| uc.call(account_id: account_id, display_name: "Persona #{i}") }

      expect(repo.list_by_account(account_id).length).to eq(5)
      expect { uc.call(account_id: account_id, display_name: "Persona 6") }.to raise_error(limit_error)
    end

    it "counts disabled profiles toward the limit" do
      4.times { |i| uc.call(account_id: account_id, display_name: "Persona #{i}") }
      create_account_with_profile(account_id: account_id, disabled_at: Time.now)

      expect { uc.call(account_id: account_id, display_name: "Persona 6") }.to raise_error(limit_error)
    end

    it "rejects a username already used by another profile of the same account" do
      uc.call(account_id: account_id, display_name: "First", username: "shared_name")

      expect {
        uc.call(account_id: account_id, display_name: "Second", username: "SHARED_NAME")
      }.to raise_error(Errors::ValidationError)
    end
  end

  context "when the account row does not exist" do
    it "rejects the creation and creates nothing" do
      account_id = SecureRandom.uuid_v7

      expect {
        uc.call(account_id: account_id, display_name: "Solo")
      }.to raise_error(Profile::UseCases::CreateProfile::AccountNotFoundError)
      expect(repo.list_by_account(account_id)).to eq([])
    end
  end

  it "rejects a blank or whitespace-only display name" do
    account_id = create_account
    expect { uc.call(account_id: account_id, display_name: "") }.to raise_error(Errors::ValidationError)
    expect { uc.call(account_id: account_id, display_name: "   ") }.to raise_error(Errors::ValidationError)
  end

  it "rejects a display name longer than 50 characters" do
    expect {
      uc.call(account_id: create_account, display_name: "あ" * 51)
    }.to raise_error(Errors::ValidationError)
  end

  it "rejects an invalid username format" do
    expect {
      uc.call(account_id: create_account, display_name: "Coco", username: "ab")
    }.to raise_error(Errors::ValidationError)
  end

  it "does not create a profile when validation fails" do
    account_id = create_account
    expect { uc.call(account_id: account_id, display_name: "") }.to raise_error(Errors::ValidationError)

    expect(repo.list_by_account(account_id)).to eq([])
  end
end
