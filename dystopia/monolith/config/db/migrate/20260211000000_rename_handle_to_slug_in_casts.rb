# frozen_string_literal: true

ROM::SQL.migration do
  change do
    alter_table Sequel[:portfolio][:casts] do
      rename_column :handle, :slug

      drop_index nil, name: :idx_casts_handle_lower

      add_index Sequel.function(:lower, :slug), unique: true, name: :idx_casts_slug_lower, where: Sequel.lit("slug IS NOT NULL")
    end
  end
end
