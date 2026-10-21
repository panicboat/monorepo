# frozen_string_literal: true

RSpec.describe "follow approval migration", type: :database do
  let(:db) { Hanami.app["db.gateway"].connection }
  let(:migration) do
    path = File.expand_path("../../../config/db/migrate/20261023000000_add_follow_approval_required_to_profiles.rb", __dir__)
    ROM::SQL.with_gateway(Hanami.app["db.gateway"]) { eval(File.read(path), TOPLEVEL_BINDING, path) } # rubocop:disable Security/Eval
  end

  it "turns approval on for locked profiles and leaves the others off" do
    locked = create_account_with_profile(username: "migrated_locked", is_private: true)
    open_profile = create_account_with_profile(username: "migrated_open", is_private: false)

    db.transaction(savepoint: true) do
      db.alter_table(:profile__profiles) { drop_column :follow_approval_required }
      migration.apply(db, :up)

      expect(db[:profile__profiles].where(id: [locked, open_profile]).select_hash(:id, :follow_approval_required))
        .to eq(locked => true, open_profile => false)
      raise Sequel::Rollback
    end
  end
end
