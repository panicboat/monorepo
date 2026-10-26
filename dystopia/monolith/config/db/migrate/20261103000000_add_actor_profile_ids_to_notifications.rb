# frozen_string_literal: true

ROM::SQL.migration do
  up do
    alter_table(:notifications__notifications) do
      add_column :actor_profile_ids, "uuid[]", null: false, default: Sequel.lit("'{}'::uuid[]")
    end

    run "UPDATE notifications.notifications SET actor_profile_ids = ARRAY[latest_actor_profile_id]"
  end

  down do
    alter_table(:notifications__notifications) do
      drop_column :actor_profile_ids
    end
  end
end
