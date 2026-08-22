# frozen_string_literal: true

ROM::SQL.migration do
  change do
    alter_table :"portfolio__cast_schedules" do
      drop_foreign_key [:plan_id]
      drop_column :plan_id
    end
  end
end
