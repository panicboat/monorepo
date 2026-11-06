# frozen_string_literal: true

ROM::SQL.migration do
  up do
    create_table :"review__event_media" do
      column :id, :uuid, null: false
      column :event_id, :uuid, null: false
      column :media_id, :uuid, null: false
      column :media_type, :text, null: false
      column :position, :integer, null: false, default: 0
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]
      foreign_key [:event_id], :"review__events", on_delete: :cascade
      constraint :media_type_value, "media_type IN ('image', 'video')"
    end

    run "CREATE INDEX idx_review_event_media_event_id ON review.event_media (event_id)"
    run "CREATE INDEX idx_review_event_media_media_id ON review.event_media (media_id)"
  end

  down do
    drop_table :"review__event_media"
  end
end
