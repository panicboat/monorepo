# frozen_string_literal: true

namespace :migrate do
  desc "Migrate existing media data to media__files table"
  task media: :environment do
    require "securerandom"

    puts "Starting media migration..."

    # Get database connection
    db = Hanami.app["db.gateway"].connection

    # Migration for post_media
    migrate_post_media(db)

    # Migration for comment_media
    migrate_comment_media(db)

    # Migration for cast profiles
    migrate_cast_media(db)

    # Migration for guest profiles
    migrate_guest_media(db)

    puts "Media migration completed!"
  end

  def migrate_post_media(db)
    puts "\n=== Migrating post__post_media ==="

    records = db[:"post__post_media"].where(media_id: nil).exclude(url: nil).exclude(url: "").all
    puts "Found #{records.count} records to migrate"

    records.each do |record|
      media_id = SecureRandom.uuid
      url = record[:url]
      media_type = record[:media_type] || "image"

      # Create media__files record
      db[:"media__files"].insert(
        id: media_id,
        media_type: media_type,
        storage_key: url,
        filename: File.basename(url),
        content_type: media_type == "video" ? "video/mp4" : "image/jpeg",
        status: "active",
        created_at: Time.now,
        updated_at: Time.now
      )

      # Update post_media with media_id
      db[:"post__post_media"].where(id: record[:id]).update(media_id: media_id)

      print "."
    end

    puts "\nMigrated #{records.count} post_media records"
  end

  def migrate_comment_media(db)
    puts "\n=== Migrating post__comment_media ==="

    records = db[:"post__comment_media"].where(media_id: nil).exclude(url: nil).exclude(url: "").all
    puts "Found #{records.count} records to migrate"

    records.each do |record|
      media_id = SecureRandom.uuid
      url = record[:url]
      media_type = record[:media_type] || "image"

      # Create media__files record
      db[:"media__files"].insert(
        id: media_id,
        media_type: media_type,
        storage_key: url,
        filename: File.basename(url),
        content_type: media_type == "video" ? "video/mp4" : "image/jpeg",
        status: "active",
        created_at: Time.now,
        updated_at: Time.now
      )

      # Update comment_media with media_id
      db[:"post__comment_media"].where(id: record[:id]).update(media_id: media_id)

      print "."
    end

    puts "\nMigrated #{records.count} comment_media records"
  end

  def migrate_cast_media(db)
    puts "\n=== Migrating portfolio__casts ==="

    records = db[:"portfolio__casts"]
      .where(profile_media_id: nil)
      .exclude(image_path: nil)
      .exclude(image_path: "")
      .all
    puts "Found #{records.count} casts with image_path to migrate"

    records.each do |record|
      # Migrate profile image
      if record[:image_path] && !record[:image_path].empty?
        profile_media_id = SecureRandom.uuid
        db[:"media__files"].insert(
          id: profile_media_id,
          media_type: "image",
          storage_key: record[:image_path],
          filename: File.basename(record[:image_path]),
          content_type: "image/jpeg",
          status: "active",
          created_at: Time.now,
          updated_at: Time.now
        )
        db[:"portfolio__casts"].where(id: record[:id]).update(profile_media_id: profile_media_id)
      end

      # Migrate avatar image
      if record[:avatar_path] && !record[:avatar_path].empty?
        avatar_media_id = SecureRandom.uuid
        db[:"media__files"].insert(
          id: avatar_media_id,
          media_type: "image",
          storage_key: record[:avatar_path],
          filename: File.basename(record[:avatar_path]),
          content_type: "image/jpeg",
          status: "active",
          created_at: Time.now,
          updated_at: Time.now
        )
        db[:"portfolio__casts"].where(id: record[:id]).update(avatar_media_id: avatar_media_id)
      end

      # Migrate gallery images
      images = record[:images]
      if images.is_a?(Array) && images.any?
        images.each_with_index do |img_path, idx|
          next if img_path.nil? || img_path.empty?

          gallery_media_id = SecureRandom.uuid
          db[:"media__files"].insert(
            id: gallery_media_id,
            media_type: "image",
            storage_key: img_path,
            filename: File.basename(img_path),
            content_type: "image/jpeg",
            status: "active",
            created_at: Time.now,
            updated_at: Time.now
          )

          db[:"portfolio__cast_gallery_media"].insert(
            id: SecureRandom.uuid,
            cast_id: record[:id],
            media_id: gallery_media_id,
            position: idx,
            created_at: Time.now,
            updated_at: Time.now
          )
        end
      end

      print "."
    end

    puts "\nMigrated #{records.count} cast records"
  end

  def migrate_guest_media(db)
    puts "\n=== Migrating portfolio__guests ==="

    records = db[:"portfolio__guests"]
      .where(avatar_media_id: nil)
      .exclude(avatar_path: nil)
      .exclude(avatar_path: "")
      .all
    puts "Found #{records.count} guests with avatar_path to migrate"

    records.each do |record|
      media_id = SecureRandom.uuid
      avatar_path = record[:avatar_path]

      # Create media__files record
      db[:"media__files"].insert(
        id: media_id,
        media_type: "image",
        storage_key: avatar_path,
        filename: File.basename(avatar_path),
        content_type: "image/jpeg",
        status: "active",
        created_at: Time.now,
        updated_at: Time.now
      )

      # Update guest with avatar_media_id
      db[:"portfolio__guests"].where(id: record[:id]).update(avatar_media_id: media_id)

      print "."
    end

    puts "\nMigrated #{records.count} guest records"
  end
end
