
ROM::SQL.migration do
  change do
    create_table :portfolio__cast_plans do
      column :id, :uuid, default: Sequel.function(:gen_random_uuid), primary_key: true
      foreign_key :cast_id, :portfolio__casts, on_delete: :cascade, type: :uuid, null: false, index: true

      column :name, String, null: false
      column :price, Integer, null: false # JPY
      column :duration_minutes, Integer, null: false

      column :created_at, DateTime, null: false, default: Sequel::CURRENT_TIMESTAMP
      column :updated_at, DateTime, null: false, default: Sequel::CURRENT_TIMESTAMP
    end

    create_table :portfolio__cast_schedules do
      column :id, :uuid, default: Sequel.function(:gen_random_uuid), primary_key: true
      foreign_key :cast_id, :portfolio__casts, on_delete: :cascade, type: :uuid, null: false, index: true

      column :date, Date, null: false
      column :start_time, String, null: false # HH:mm
      column :end_time, String, null: false   # HH:mm
      foreign_key :plan_id, :portfolio__cast_plans, type: :uuid, null: true, on_delete: :set_null # Optional link

      column :created_at, DateTime, null: false, default: Sequel::CURRENT_TIMESTAMP
      column :updated_at, DateTime, null: false, default: Sequel::CURRENT_TIMESTAMP
    end
  end
end
