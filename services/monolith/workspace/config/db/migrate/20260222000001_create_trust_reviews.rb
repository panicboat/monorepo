# frozen_string_literal: true

ROM::SQL.migration do
  up do
    create_table :"trust__reviews" do
      column :id, :uuid, default: Sequel.lit("gen_random_uuid()"), null: false
      column :reviewer_id, :uuid, null: false
      column :reviewee_id, :uuid, null: false
      column :content, :text, null: true
      column :score, :integer, null: false
      column :status, :text, default: "approved", null: false
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")
      column :updated_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]

      constraint(:score_range) { (score >= 1) & (score <= 5) }

      index :reviewer_id
      index :reviewee_id
      index :status
    end
  end

  down do
    drop_table :"trust__reviews"
  end
end
