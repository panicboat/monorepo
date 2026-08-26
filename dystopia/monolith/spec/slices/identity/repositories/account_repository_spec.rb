# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Identity::Repositories::AccountRepository", type: :database do
  let(:repo) { Hanami.app.slices[:identity]["repositories.account_repository"] }
  let(:db) { Hanami.app["db.gateway"].connection }
  let(:sub) { "11111111-1111-1111-1111-111111111111" }

  describe "#create" do
    it "creates an account with the given sub and role" do
      account = repo.create(sub: sub, role: 1)

      expect(account.id).to eq(sub)
      expect(account.role).to eq(1)
      expect(account.deactivated_at).to be_nil
      expect(account.created_at).not_to be_nil
      expect(account.updated_at).not_to be_nil
    end

    it "raises on duplicate sub" do
      repo.create(sub: sub, role: 1)

      expect { repo.create(sub: sub, role: 2) }.to raise_error(Sequel::UniqueConstraintViolation)
    end
  end

  describe "#find_by_id" do
    it "returns nil when the account does not exist" do
      expect(repo.find_by_id("00000000-0000-0000-0000-000000000000")).to be_nil
    end

    it "returns the account when it exists" do
      repo.create(sub: sub, role: 2)

      expect(repo.find_by_id(sub).role).to eq(2)
    end
  end

  describe "#mark_deactivated" do
    it "sets deactivated_at to now and returns nil" do
      repo.create(sub: sub, role: 1)

      expect(repo.mark_deactivated(sub)).to be_nil
      expect(repo.find_by_id(sub).deactivated_at).not_to be_nil
    end
  end

  describe "#reactivate" do
    it "clears deactivated_at and returns nil" do
      repo.create(sub: sub, role: 1)
      repo.mark_deactivated(sub)

      expect(repo.reactivate(sub)).to be_nil
      expect(repo.find_by_id(sub).deactivated_at).to be_nil
    end
  end

  describe "#delete" do
    it "removes the account row and returns nil" do
      repo.create(sub: sub, role: 1)

      expect(repo.delete(sub)).to be_nil
      expect(repo.find_by_id(sub)).to be_nil
    end
  end

  describe "#deactivated_before" do
    it "yields only accounts whose deactivated_at is older than cutoff" do
      old = "22222222-2222-2222-2222-222222222222"
      recent = "33333333-3333-3333-3333-333333333333"
      repo.create(sub: old, role: 1)
      repo.create(sub: recent, role: 1)
      repo.mark_deactivated(old)
      db[:identity__accounts].where(id: old).update(deactivated_at: Time.now - (60 * 60 * 24 * 31))
      repo.mark_deactivated(recent)

      cutoff = Time.now - (60 * 60 * 24 * 30)
      deactivated_accounts = repo.deactivated_before(cutoff)

      expect(deactivated_accounts).to be_a(Enumerator)
      expect(deactivated_accounts.map(&:id)).to eq([old])
    end
  end
end
