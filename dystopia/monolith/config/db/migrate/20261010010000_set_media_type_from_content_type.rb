# frozen_string_literal: true

ROM::SQL.migration do
  up do
    run <<~SQL
      UPDATE media.files
      SET media_type = split_part(content_type, '/', 1)
      WHERE media_type = 'unknown'
        AND split_part(content_type, '/', 1) IN ('image', 'video')
    SQL
  end

  down do
    # The kind each row had before cannot be told apart from the repaired one, so there is nothing to restore.
  end
end
