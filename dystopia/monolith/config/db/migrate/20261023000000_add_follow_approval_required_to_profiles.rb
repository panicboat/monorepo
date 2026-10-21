# frozen_string_literal: true

ROM::SQL.migration do
  up do
    alter_table(:profile__profiles) do
      add_column :follow_approval_required, :boolean, null: false, default: false
    end
    run "UPDATE profile.profiles SET follow_approval_required = true WHERE is_private"
  end

  down do
    alter_table(:profile__profiles) do
      drop_column :follow_approval_required
    end
  end
end
