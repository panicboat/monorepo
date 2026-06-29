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

      # Lightweight lookup for cursor pagination: returns just the created_at
      # for an id without eager-loading post_media / hashtags. Used by feed
      # slice cursor encoding (see Feed::UseCases::ListFeed).
      def created_at_for_id(id)
        posts.dataset.where(id: id).get(:created_at)
      end

      # Batch fetch posts by id list. Used by cross-slice consumers (e.g. feed slice)
      # that have already determined which posts to display and need full hydration.
      # Returns an unordered array — caller is responsible for re-ordering if needed.
      # Caller MUST pre-filter for visibility (e.g. only "public") and any soft-delete
      # scoping; this method intentionally does not apply visibility filters so it can
      # serve owner-view / admin paths uniformly.
      def find_by_ids(ids:)
        return [] if ids.nil? || ids.empty?

        posts.combine(:post_media, :hashtags).where(id: ids).to_a
      end

      def find_by_id_and_cast(id:, cast_user_id:)
        posts.combine(:post_media, :hashtags).where(id: id, cast_user_id: cast_user_id).one
      end

      def create_post(data)
        posts.changeset(:create, data.merge(id: SecureRandom.uuid_v7)).commit
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
          post_media.changeset(:create, media.merge(id: SecureRandom.uuid_v7, post_id: post_id, position: index)).commit
        end
      end

      def save_hashtags(post_id:, hashtags:)
        self.hashtags.dataset.where(post_id: post_id).delete
        hashtags.each_with_index do |tag, index|
          next if tag.nil? || tag.strip.empty?

          self.hashtags.changeset(:create, id: SecureRandom.uuid_v7, post_id: post_id, tag: tag.strip, position: index).commit
        end
      end

      def list_posts(limit: 20, cursor: nil, author_id: nil, media_only: false)
        scope = posts.combine(:post_media, :hashtags).exclude(author_id: nil).where(visibility: "public")
        scope = scope.where(author_id: author_id) if author_id

        if media_only
          # Filter to posts that have at least one media attachment.
          # `post_media` relation reader is not exposed on this repo, so we go via the
          # underlying Sequel dataset to build a distinct subquery of post_ids that
          # have media rows.
          media_post_ids = posts.dataset.db[:post__post_media].select(:post_id).distinct
          scope = scope.where(id: media_post_ids)
        end

        if cursor
          scope = scope.where {
            (created_at < cursor[:created_at]) |
              ((created_at =~ cursor[:created_at]) & (id < cursor[:id]))
          }
        end

        scope.order { [created_at.desc, id.desc] }.limit(limit + 1).to_a
      end

      # Symmetric public post id query for feed slice (cursor-paginated).
      # Returns an array of post ids (String) ordered by created_at DESC, id DESC.
      # Filters: visibility='public', author_ids whitelist (if provided), excluded_author_ids blocklist.
      # Returns limit + 1 ids so caller can detect has_more.
      # author_ids semantics: nil = no whitelist (all authors), [] = whitelist of nothing (return empty).
      def list_public_post_ids(limit: 20, cursor: nil, author_ids: nil, excluded_author_ids: [])
        return [] if !author_ids.nil? && author_ids.empty?

        scope = posts.dataset.where(visibility: "public")
        scope = scope.where(author_id: author_ids) if author_ids
        scope = scope.exclude(author_id: excluded_author_ids) if excluded_author_ids && !excluded_author_ids.empty?

        if cursor
          scope = scope.where {
            (created_at < cursor[:created_at]) |
              ((created_at =~ cursor[:created_at]) & (id < cursor[:id]))
          }
        end

        scope.order(Sequel.desc(:created_at), Sequel.desc(:id)).limit(limit + 1).select_map(:id).map(&:to_s)
      end

      def find_by_id_and_author(id:, author_id:)
        posts.combine(:post_media, :hashtags).where(id: id, author_id: author_id).one
      end

      # Cross-slice query for discovery slice. Case-insensitive content match
      # on public posts. Cursor (already-decoded hash) is over (created_at, id) DESC.
      # Returns limit + 1 ids so caller can detect has_more.
      def search_by_content(query:, limit: 20, cursor: nil)
        q = query.to_s.strip
        return [] if q.empty?

        pattern = "%#{q}%"
        scope = posts.dataset.where(visibility: "public").where(Sequel.lit("content ILIKE ?", pattern))

        if cursor
          scope = scope.where {
            (created_at < cursor[:created_at]) |
              ((created_at =~ cursor[:created_at]) & (id < cursor[:id]))
          }
        end

        scope.order(Sequel.desc(:created_at), Sequel.desc(:id)).limit(limit + 1).select_map(:id).map(&:to_s)
      end

      # Cross-slice query for discovery ranking. Top public posts by like count
      # within the period. period: 'day' | 'week' | 'all'.
      # likes_count is aggregated from post__likes via LEFT JOIN — posts table
      # has no denormalized counter column.
      # Cursor (already-decoded hash) is semantically (likes_count, id) DESC —
      # cursor[:created_at] is reused to carry likes_count as an integer-string.
      # Returns [[id, likes_count], ...] so caller can encode the next cursor
      # without an additional lookup.
      def top_by_likes(period:, limit: 20, cursor: nil)
        ds = posts.dataset.where(visibility: "public")

        case period.to_s
        when "day"
          ds = ds.where { created_at >= Sequel.lit("NOW() - INTERVAL '1 day'") }
        when "week"
          ds = ds.where { created_at >= Sequel.lit("NOW() - INTERVAL '7 days'") }
        when "all"
          # no period filter
        else
          return []
        end

        likes_count_expr = Sequel.function(:coalesce, Sequel.function(:count, Sequel[:post__likes][:id]), 0)

        scope = ds
          .left_join(:post__likes, post_id: Sequel[:post__posts][:id])
          .group(Sequel[:post__posts][:id])
          .select(Sequel[:post__posts][:id], likes_count_expr.as(:likes_count))

        if cursor
          likes_at = cursor[:created_at].to_i
          scope = scope.having {
            (likes_count_expr < likes_at) |
              ((likes_count_expr =~ likes_at) & (Sequel[:post__posts][:id] < cursor[:id]))
          }
        end

        scope
          .order(Sequel.desc(:likes_count), Sequel.desc(Sequel[:post__posts][:id]))
          .limit(limit + 1)
          .map { |row| [row[:id].to_s, row[:likes_count].to_i] }
      end

      def delete_by_author(account_id)
        posts.dataset.where(Sequel.|({cast_user_id: account_id}, {author_id: account_id})).delete
      end
    end
  end
end
