# frozen_string_literal: true

# Add status column to cast_follows for follow approval workflow
#
# Status values:
# - pending: Follow request awaiting approval (for private casts)
# - approved: Follow relationship is active

ROM::SQL.migration do
  up do
    alter_table :"social__cast_follows" do
      add_column :status, :text, null: false, default: "approved"
    end

    # Add index for efficient pending request queries
    alter_table :"social__cast_follows" do
      add_index :status
    end
  end

  down do
    alter_table :"social__cast_follows" do
      drop_index :status
      drop_column :status
    end
  end
end
