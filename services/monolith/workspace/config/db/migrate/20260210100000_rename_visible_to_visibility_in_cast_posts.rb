# frozen_string_literal: true

ROM::SQL.migration do
  up do
    alter_table :"social__cast_posts" do
      add_column :visibility, :text, null: false, default: "public"
    end

    run "UPDATE social.cast_posts SET visibility = CASE WHEN visible THEN 'public' ELSE 'private' END"

    alter_table :"social__cast_posts" do
      drop_column :visible
    end
  end

  down do
    alter_table :"social__cast_posts" do
      add_column :visible, :boolean, null: false, default: true
    end

    run "UPDATE social.cast_posts SET visible = (visibility = 'public')"

    alter_table :"social__cast_posts" do
      drop_column :visibility
    end
  end
end
