# frozen_string_literal: true

require "spec_helper"
require "uri"
require "rom/sql/migration"

RSpec.describe "karte storage migration" do
  around do |example|
    uri = URI.parse(ENV.fetch("DATABASE_URL"))
    admin_uri = uri.dup
    admin_uri.path = "/postgres"
    admin = Sequel.connect(admin_uri.to_s, max_connections: 1)
    database_name = "dystopia_karte_migration_#{SecureRandom.hex(6)}"
    created = false
    begin
      admin.run("CREATE DATABASE #{database_name}")
      created = true
      uri.path = "/#{database_name}"
      @gateway = ROM::SQL::Gateway.new(uri.to_s)
      @db = @gateway.connection
      @db.run("CREATE SCHEMA karte")
      @db.create_table(:"karte__entries") do
        column :id, :uuid, primary_key: true
        column :author_account_id, :uuid, null: false
        column :author_profile_id, :uuid, null: false
        column :target_profile_id, :uuid, null: false
        column :rating, :integer, null: false
        column :body, :text
        column :reported_count, :integer, null: false, default: 0
        column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")
        column :updated_at, :timestamptz, null: false, default: Sequel.lit("now()")
        constraint :rating_range, "rating BETWEEN 1 AND 5"
      end
      @db.create_table(:"karte__reports") do
        column :id, :uuid, primary_key: true
        column :entry_id, :uuid, null: false
        column :reporter_account_id, :uuid, null: false
        column :reason, :text
        column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")
        unique [:entry_id, :reporter_account_id]
      end
      @legacy = {id: SecureRandom.uuid_v7, author_account_id: SecureRandom.uuid_v7, author_profile_id: SecureRandom.uuid_v7, target_profile_id: SecureRandom.uuid_v7, rating: 1, body: "", reported_count: 2, created_at: Time.utc(2026, 9, 1), updated_at: Time.utc(2026, 9, 2)}
      @db[:karte__entries].insert(@legacy)
      @report = {id: SecureRandom.uuid_v7, entry_id: @legacy[:id], reporter_account_id: SecureRandom.uuid_v7, reason: "事実関係の確認", created_at: Time.utc(2026, 9, 3)}
      @db[:karte__reports].insert(@report)
      path = SPEC_ROOT.join("../config/db/migrate/20261012000000_add_karte_events_and_entry_status.rb").to_s
      migration = ROM::SQL.with_gateway(@gateway) { eval(File.read(path), TOPLEVEL_BINDING, path) }
      migration.apply(@db, :up)
      example.run
    ensure
      @db&.disconnect
      admin.run("DROP DATABASE #{database_name}") if created
      admin.disconnect
    end
  end

  it "preserves legacy data and reports without inventing events" do
    row = @db[:karte__entries].where(id: @legacy[:id]).first
    expect(row.slice(*@legacy.keys)).to eq(@legacy)
    expect(row.slice(:status, :closed_at)).to eq(status: "closed", closed_at: Time.utc(2026, 9, 2))
    expect(@db[:karte__events].where(entry_id: @legacy[:id]).all).to eq([])
    expect(@db[:karte__reports].first).to eq(@report)
  end

  it "defaults new unrated charts to open and cascades their events on deletion" do
    id = SecureRandom.uuid_v7
    @db[:karte__entries].insert(@legacy.slice(:author_account_id, :author_profile_id, :target_profile_id).merge(id: id, rating: nil))
    row = @db[:karte__entries].where(id: id).first
    expect(row.slice(:status, :closed_at, :rating)).to eq(status: "open", closed_at: nil, rating: nil)
    @db[:karte__events].insert(id: SecureRandom.uuid_v7, entry_id: id, stage: "booking", outcome: "confirmed", occurred_on: Date.new(2026, 10, 12))
    @db[:karte__entries].where(id: id).delete
    expect(@db[:karte__events].where(entry_id: id).count).to eq(0)
  end
end
