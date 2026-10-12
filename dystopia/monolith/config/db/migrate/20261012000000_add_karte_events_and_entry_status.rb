# frozen_string_literal: true

ROM::SQL.migration do
  up do
    alter_table :"karte__entries" do
      set_column_allow_null :rating
      add_column :status, :text
      add_column :closed_at, :timestamptz
    end
    self[:karte__entries].update(status: "closed", closed_at: Sequel[:updated_at])
    alter_table :"karte__entries" do
      set_column_not_null :status
      set_column_default :status, "open"
      add_constraint :entry_status, "status IN ('open', 'closed')"
      add_constraint :entry_completion, "(status = 'open' AND closed_at IS NULL) OR (status = 'closed' AND closed_at IS NOT NULL)"
    end

    create_table :"karte__events" do
      column :id, :uuid, null: false
      foreign_key :entry_id, :"karte__entries", type: :uuid, null: false, on_delete: :cascade
      column :stage, :text, null: false
      column :outcome, :text, null: false
      column :tags, :jsonb, null: false, default: Sequel.lit("'[]'::jsonb")
      column :note, :text, null: false, default: ""
      column :occurred_on, :date, null: false
      column :created_at, :timestamptz, null: false, default: Sequel.lit("clock_timestamp()")
      column :updated_at, :timestamptz, null: false, default: Sequel.lit("clock_timestamp()")
      primary_key [:id]
      constraint :event_stage, "stage IN ('booking', 'service', 'after_service')"
      constraint :event_tags, "jsonb_typeof(tags) = 'array'"
    end
    run "CREATE INDEX idx_karte_events_entry_created ON karte.events (entry_id, created_at DESC, id DESC)"
  end

  down do
    raise Sequel::Error, "irreversible: event records and unrated charts cannot be represented in the rating-only schema"
  end
end
