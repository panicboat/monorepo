# frozen_string_literal: true

ROM::SQL.migration do
  up do
    create_schema :portfolio

    create_table :portfolio__casts do
      column :id, :uuid, default: Sequel.function(:gen_random_uuid), primary_key: true
      column :user_id, :uuid, null: false
      column :name, String, null: false
      column :tagline, String
      column :bio, String, text: true
      column :service_category, String
      column :location_type, String
      column :area, String
      column :status, String, default: 'offline'
      column :promise_rate, Float
      column :age, Integer
      column :height, Integer
      column :blood_type, String
      column :occupation, String
      column :charm_point, String
      column :personality, String
      column :bust, Integer
      column :waist, Integer
      column :hip, Integer
      column :cup_size, String
      column :images, :jsonb, default: '[]'
      column :tags, :jsonb, default: '[]'
      column :social_links, :jsonb, default: '{}'
      column :default_shift_start, String
      column :default_shift_end, String
      column :created_at, DateTime, null: false, default: Sequel::CURRENT_TIMESTAMP
      column :updated_at, DateTime, null: false, default: Sequel::CURRENT_TIMESTAMP

      index :user_id, unique: true
    end
  end

  down do
    drop_table :portfolio__casts
    run 'DROP SCHEMA IF EXISTS portfolio'
  end
end
