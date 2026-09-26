# frozen_string_literal: true

ROM::SQL.migration do
  up do
    run "CREATE SCHEMA IF NOT EXISTS review"

    create_table :"review__entries" do
      column :id, :uuid, null: false
      column :author_account_id, :uuid, null: false
      column :target_account_id, :uuid, null: false
      column :rating, :"numeric(2,1)", null: false
      column :body, :text
      column :hidden, :boolean, null: false, default: false
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")
      column :updated_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]
      constraint :rating_step,
        "rating IN (0.5,1.0,1.5,2.0,2.5,3.0,3.5,4.0,4.5,5.0)"
    end

    run <<~SQL
      CREATE INDEX idx_review_entries_target_created
        ON review.entries (target_account_id, created_at DESC, id DESC)
    SQL
    run <<~SQL
      CREATE INDEX idx_review_entries_author_created
        ON review.entries (author_account_id, created_at DESC, id DESC)
    SQL

    create_table :"review__cast_settings" do
      column :account_id, :uuid, null: false
      column :reviews_visible, :boolean, null: false, default: true
      column :updated_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:account_id]
    end
  end

  down do
    drop_table :"review__cast_settings"
    drop_table :"review__entries"
    run "DROP SCHEMA IF EXISTS review CASCADE"
  end
end
