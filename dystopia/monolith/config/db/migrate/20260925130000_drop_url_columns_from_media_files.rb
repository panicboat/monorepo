# frozen_string_literal: true

ROM::SQL.migration do
  up do
    alter_table :"media__files" do
      drop_column :url
      drop_column :thumbnail_url
    end
  end

  down do
    alter_table :"media__files" do
      add_column :url, :text, null: false, default: ""
      add_column :thumbnail_url, :text
    end
  end
end
