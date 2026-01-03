ROM::SQL.migration do
  change do
    # Create schema if needed
    run 'CREATE SCHEMA IF NOT EXISTS "cast"' if adapter_scheme == :postgres

    create_table(Sequel.qualify(:cast, :casts)) do
      primary_key :id
      foreign_key :user_id, Sequel.qualify(:identity, :users), null: false, on_delete: :cascade, unique: true
      String :name, null: false
      String :bio, text: true
      String :image_url
      String :status, default: 'offline' # offline, asking, online, tonight
      Float :promise_rate, default: 1.0
      DateTime :created_at, null: false, default: Sequel::CURRENT_TIMESTAMP
      DateTime :updated_at, null: false, default: Sequel::CURRENT_TIMESTAMP
    end

    create_table(Sequel.qualify(:cast, :cast_plans)) do
      primary_key :id
      foreign_key :cast_id, Sequel.qualify(:cast, :casts), null: false, on_delete: :cascade
      String :name, null: false # e.g. "VIP", "Short"
      Integer :price, null: false # JPY
      Integer :duration_minutes, null: false
      DateTime :created_at, null: false, default: Sequel::CURRENT_TIMESTAMP
      DateTime :updated_at, null: false, default: Sequel::CURRENT_TIMESTAMP
    end
  end
end
