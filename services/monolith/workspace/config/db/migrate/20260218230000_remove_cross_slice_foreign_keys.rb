# frozen_string_literal: true

ROM::SQL.migration do
  up do
    # Remove cross-slice foreign keys to media__files (modular monolith principle)
    alter_table :"post__post_media" do
      drop_foreign_key [:media_id]
    end

    alter_table :"post__comment_media" do
      drop_foreign_key [:media_id]
    end

    alter_table :"portfolio__casts" do
      drop_foreign_key [:profile_media_id]
      drop_foreign_key [:avatar_media_id]
    end

    alter_table :"portfolio__guests" do
      drop_foreign_key [:avatar_media_id]
    end

    alter_table :"portfolio__cast_gallery_media" do
      drop_foreign_key [:media_id]
    end
  end

  down do
    # Re-add foreign keys (not recommended for modular monolith)
    alter_table :"post__post_media" do
      add_foreign_key [:media_id], :"media__files", on_delete: :set_null
    end

    alter_table :"post__comment_media" do
      add_foreign_key [:media_id], :"media__files", on_delete: :set_null
    end

    alter_table :"portfolio__casts" do
      add_foreign_key [:profile_media_id], :"media__files", on_delete: :set_null
      add_foreign_key [:avatar_media_id], :"media__files", on_delete: :set_null
    end

    alter_table :"portfolio__guests" do
      add_foreign_key [:avatar_media_id], :"media__files", on_delete: :set_null
    end

    alter_table :"portfolio__cast_gallery_media" do
      add_foreign_key [:media_id], :"media__files", on_delete: :cascade
    end
  end
end
