# frozen_string_literal: true

ROM::SQL.migration do
  up do
    alter_table :"trust__review_media" do
      drop_index :review_id
      add_index %i[review_id position], unique: true
      add_constraint(:review_media_media_type_check, Sequel.lit("media_type IN ('image', 'video')"))
      add_constraint(:review_media_position_range_check, Sequel.lit("position BETWEEN 0 AND 2"))
    end
  end

  down do
    alter_table :"trust__review_media" do
      drop_constraint :review_media_position_range_check
      drop_constraint :review_media_media_type_check
      drop_index %i[review_id position], unique: true
      add_index :review_id
    end
  end
end
