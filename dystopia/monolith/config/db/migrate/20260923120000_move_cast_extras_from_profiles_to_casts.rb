# frozen_string_literal: true

ROM::SQL.migration do
  up do
    alter_table :"profile__casts" do
      add_column :sns_links, :jsonb, null: false, default: Sequel.lit("'{}'::jsonb")
      add_column :age, :integer
      add_column :body_stats, :jsonb, null: false, default: Sequel.lit("'{}'::jsonb")
      add_column :industry, :varchar, size: 50
    end

    run <<~SQL
      UPDATE profile.casts c
      SET sns_links = p.sns_links, age = p.age, body_stats = p.body_stats, industry = p.industry
      FROM profile.profiles p
      JOIN identity.accounts a ON a.id = p.account_id
      WHERE c.user_id = p.account_id AND a.role = 2
    SQL

    alter_table :"profile__casts" do
      drop_column :visibility
    end

    alter_table :"profile__profiles" do
      drop_column :sns_links
      drop_column :age
      drop_column :body_stats
      drop_column :industry
    end
  end

  down do
    alter_table :"profile__profiles" do
      add_column :sns_links, :jsonb, null: false, default: Sequel.lit("'{}'::jsonb")
      add_column :age, :integer
      add_column :body_stats, :jsonb, null: false, default: Sequel.lit("'{}'::jsonb")
      add_column :industry, :varchar, size: 50
    end

    alter_table :"profile__casts" do
      add_column :visibility, :text, default: "offline"
      drop_column :sns_links
      drop_column :age
      drop_column :body_stats
      drop_column :industry
    end
  end
end
