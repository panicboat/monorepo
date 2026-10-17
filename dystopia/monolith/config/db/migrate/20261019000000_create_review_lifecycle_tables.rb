# frozen_string_literal: true

ROM::SQL.migration do
  up do
    create_table :"review__reviews" do
      column :id, :uuid, null: false
      column :author_account_id, :uuid, null: false
      column :author_profile_id, :uuid, null: false
      column :target_profile_id, :uuid, null: false
      column :rating, :smallint
      column :status, :text, null: false
      column :closed_at, :timestamptz
      column :last_activity_at, :timestamptz, null: false, default: Sequel.lit("now()")
      column :last_occurred_on, :date, null: false
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")
      column :updated_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]
      constraint :rating_range, "rating BETWEEN 1 AND 5"
      constraint :status_value, "status IN ('open', 'closed')"
      constraint :closed_at_matches_status, "(status = 'closed') = (closed_at IS NOT NULL)"
      constraint :closed_review_rated, "status = 'open' OR rating IS NOT NULL"
    end

    run "CREATE INDEX idx_review_reviews_target_activity ON review.reviews (target_profile_id, last_activity_at DESC, id DESC)"
    run "CREATE INDEX idx_review_reviews_author_profile_activity ON review.reviews (author_profile_id, last_activity_at DESC, id DESC)"
    run "CREATE INDEX idx_review_reviews_author_account_activity ON review.reviews (author_account_id, last_activity_at DESC, id DESC)"
    run "CREATE INDEX idx_review_reviews_occurred ON review.reviews (last_occurred_on DESC, created_at DESC, id DESC)"
    run "CREATE INDEX idx_review_reviews_summary ON review.reviews (target_profile_id, author_profile_id) WHERE status = 'closed'"

    create_table :"review__events" do
      column :id, :uuid, null: false
      column :review_id, :uuid, null: false
      column :stage, :text, null: false
      column :outcome, :text, null: false
      column :tags, "text[]", null: false, default: Sequel.lit("'{}'::text[]")
      column :note, :text
      column :occurred_on, :date, null: false
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")
      column :updated_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]
      foreign_key [:review_id], :"review__reviews", on_delete: :cascade
      constraint :stage_value, "stage IN ('reservation', 'service', 'aftercare')"
    end

    run "CREATE INDEX idx_review_events_review_occurred ON review.events (review_id, occurred_on, created_at)"
  end

  down do
    drop_table :"review__events"
    drop_table :"review__reviews"
  end
end
