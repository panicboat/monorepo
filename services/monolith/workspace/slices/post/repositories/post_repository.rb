# frozen_string_literal: true

module Post
  module Repositories
    class PostRepository < Post::DB::Repo
      commands :create, update: :by_pk, delete: :by_pk

      def list_by_cast_user_id(cast_user_id:, limit: 20, cursor: nil)
        scope = posts.combine(:post_media, :hashtags).where(cast_user_id: cast_user_id)

        if cursor
          scope = scope.where {
            (created_at < cursor[:created_at]) |
              ((created_at =~ cursor[:created_at]) & (id < cursor[:id]))
          }
        end

        scope.order { [created_at.desc, id.desc] }.limit(limit + 1).to_a
      end

      def list_all_visible(limit: 20, cursor: nil, cast_user_id: nil, cast_user_ids: nil, exclude_cast_user_ids: nil)
        scope = posts.combine(:post_media, :hashtags).where(visibility: "public")
        scope = scope.where(cast_user_id: cast_user_id) if cast_user_id
        scope = scope.where(cast_user_id: cast_user_ids) if cast_user_ids && !cast_user_ids.empty?
        scope = scope.exclude(cast_user_id: exclude_cast_user_ids) if exclude_cast_user_ids && !exclude_cast_user_ids.empty?

        if cursor
          scope = scope.where {
            (created_at < cursor[:created_at]) |
              ((created_at =~ cursor[:created_at]) & (id < cursor[:id]))
          }
        end

        scope.order { [created_at.desc, id.desc] }.limit(limit + 1).to_a
      end

      # List posts for authenticated user's "All" timeline.
      # Returns: public posts from public casts + all posts from followed casts
      def list_all_for_authenticated(public_cast_user_ids:, followed_cast_user_ids:, limit: 20, cursor: nil, exclude_cast_user_ids: nil)
        scope = posts.combine(:post_media, :hashtags)

        # Build OR condition: (public cast + public post) OR (followed cast)
        if followed_cast_user_ids.empty?
          # No follows: only show public posts from public casts
          scope = scope.where(cast_user_id: public_cast_user_ids, visibility: "public")
        elsif public_cast_user_ids.empty?
          # No public casts: only show posts from followed casts
          scope = scope.where(cast_user_id: followed_cast_user_ids)
        else
          # Combine: (public cast + public post) OR (followed cast)
          scope = scope.where {
            ((Sequel.expr(cast_user_id: public_cast_user_ids) & Sequel.expr(visibility: "public")) |
              Sequel.expr(cast_user_id: followed_cast_user_ids))
          }
        end

        scope = scope.exclude(cast_user_id: exclude_cast_user_ids) if exclude_cast_user_ids && !exclude_cast_user_ids.empty?

        if cursor
          scope = scope.where {
            (created_at < cursor[:created_at]) |
              ((created_at =~ cursor[:created_at]) & (id < cursor[:id]))
          }
        end

        scope.order { [created_at.desc, id.desc] }.limit(limit + 1).to_a
      end

      # List all posts by cast IDs (no visibility filter).
      # Used for approved followers who can see all posts from followed casts.
      def list_all_by_cast_user_ids(cast_user_ids:, limit: 20, cursor: nil, exclude_cast_user_ids: nil)
        return [] if cast_user_ids.nil? || cast_user_ids.empty?

        scope = posts.combine(:post_media, :hashtags)
        scope = scope.where(cast_user_id: cast_user_ids)
        scope = scope.exclude(cast_user_id: exclude_cast_user_ids) if exclude_cast_user_ids && !exclude_cast_user_ids.empty?

        if cursor
          scope = scope.where {
            (created_at < cursor[:created_at]) |
              ((created_at =~ cursor[:created_at]) & (id < cursor[:id]))
          }
        end

        scope.order { [created_at.desc, id.desc] }.limit(limit + 1).to_a
      end

      def find_by_id(id)
        posts.combine(:post_media, :hashtags).by_pk(id).one
      end

      def find_by_id_and_cast(id:, cast_user_id:)
        posts.combine(:post_media, :hashtags).where(id: id, cast_user_id: cast_user_id).one
      end

      def create_post(data)
        posts.changeset(:create, data).commit
      end

      def update_post(id, data)
        posts.dataset.where(id: id).update(data.merge(updated_at: Time.now))
        find_by_id(id)
      end

      def delete_post(id)
        posts.dataset.where(id: id).delete
      end

      def save_media(post_id:, media_data:)
        post_media.dataset.where(post_id: post_id).delete
        media_data.each_with_index do |media, index|
          post_media.changeset(:create, media.merge(post_id: post_id, position: index)).commit
        end
      end

      def save_hashtags(post_id:, hashtags:)
        self.hashtags.dataset.where(post_id: post_id).delete
        hashtags.each_with_index do |tag, index|
          next if tag.nil? || tag.strip.empty?

          self.hashtags.changeset(:create, post_id: post_id, tag: tag.strip, position: index).commit
        end
      end
    end
  end
end
