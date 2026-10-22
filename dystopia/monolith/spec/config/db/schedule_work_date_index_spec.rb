# frozen_string_literal: true

RSpec.describe "schedule work date index migration", type: :database do
  let(:db) { Hanami.app["db.gateway"].connection }
  let(:migration) do
    path = File.expand_path("../../../config/db/migrate/20261026000000_add_work_date_index_to_schedules.rb", __dir__)
    ROM::SQL.with_gateway(Hanami.app["db.gateway"]) { eval(File.read(path), TOPLEVEL_BINDING, path) } # rubocop:disable Security/Eval
  end

  def index_definition
    db[:pg_indexes].where(schemaname: "schedule", tablename: "schedules", indexname: "idx_schedule_schedules_work_date_start_time").get(:indexdef)
  end

  it "indexes the work date and the start time together" do
    expect(index_definition).to include("(work_date, start_time)")
  end

  it "drops the index on the way down and creates it again on the way up" do
    db.transaction(savepoint: true) do
      migration.apply(db, :down)
      expect(index_definition).to be_nil
      migration.apply(db, :up)
      expect(index_definition).to include("(work_date, start_time)")
      raise Sequel::Rollback
    end
  end
end
