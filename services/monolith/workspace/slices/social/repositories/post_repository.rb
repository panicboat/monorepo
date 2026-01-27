# frozen_string_literal: true

module Social
  module Repositories
    class PostRepository < Social::DB::Repo
      commands :create, update: :by_pk, delete: :by_pk

      def list_by_cast_id(cast_id:, limit: 20, cursor: nil)
        scope = cast_posts.combine(:cast_post_media).where(cast_id: cast_id)

        if cursor
          scope = scope.where { created_at < cursor[:created_at] }
            .or { (created_at =~ cursor[:created_at]) & (id < cursor[:id]) }
        end

        scope.order { [created_at.desc, id.desc] }.limit(limit + 1).to_a
      end

      def find_by_id(id)
        cast_posts.combine(:cast_post_media).by_pk(id).one
      end

      def find_by_id_and_cast(id:, cast_id:)
        cast_posts.combine(:cast_post_media).where(id: id, cast_id: cast_id).one
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
    end
  end
end
