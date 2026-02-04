# frozen_string_literal: true

module Social
  module Repositories
    class PostRepository < Social::DB::Repo
      commands :create, update: :by_pk, delete: :by_pk

      def list_by_cast_id(cast_id:, limit: 20, cursor: nil)
        scope = cast_posts.combine(:cast_post_media, :cast_post_hashtags).where(cast_id: cast_id)

        if cursor
          scope = scope.where {
            (created_at < cursor[:created_at]) |
              ((created_at =~ cursor[:created_at]) & (id < cursor[:id]))
          }
        end

        scope.order { [created_at.desc, id.desc] }.limit(limit + 1).to_a
      end

      def list_all_visible(limit: 20, cursor: nil, cast_id: nil, cast_ids: nil)
        scope = cast_posts.combine(:cast_post_media, :cast_post_hashtags).where(visible: true)
        scope = scope.where(cast_id: cast_id) if cast_id
        scope = scope.where(cast_id: cast_ids) if cast_ids && !cast_ids.empty?

        if cursor
          scope = scope.where {
            (created_at < cursor[:created_at]) |
              ((created_at =~ cursor[:created_at]) & (id < cursor[:id]))
          }
        end

        scope.order { [created_at.desc, id.desc] }.limit(limit + 1).to_a
      end

      def find_by_id(id)
        cast_posts.combine(:cast_post_media, :cast_post_hashtags).by_pk(id).one
      end

      def find_by_id_and_cast(id:, cast_id:)
        cast_posts.combine(:cast_post_media, :cast_post_hashtags).where(id: id, cast_id: cast_id).one
      end

      def create_post(data)
        cast_posts.changeset(:create, data).commit
      end

      def update_post(id, data)
        cast_posts.dataset.where(id: id).update(data.merge(updated_at: Time.now))
        find_by_id(id)
      end

      def delete_post(id)
        cast_posts.dataset.where(id: id).delete
      end

      def save_media(post_id:, media_data:)
        cast_post_media.dataset.where(post_id: post_id).delete
        media_data.each_with_index do |media, index|
          cast_post_media.changeset(:create, media.merge(post_id: post_id, position: index)).commit
        end
      end

      def save_hashtags(post_id:, hashtags:)
        cast_post_hashtags.dataset.where(post_id: post_id).delete
        hashtags.each_with_index do |tag, index|
          next if tag.nil? || tag.strip.empty?

          cast_post_hashtags.changeset(:create, post_id: post_id, tag: tag.strip, position: index).commit
        end
      end
    end
  end
end
