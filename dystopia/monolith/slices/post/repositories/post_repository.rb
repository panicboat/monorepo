# frozen_string_literal: true

module Post
  module Repositories
    class PostRepository < Post::DB::Repo
      commands :create, update: :by_pk, delete: :by_pk

      def find_by_id(id)
        posts.combine(:post_media, :hashtags, :post_mentions).by_pk(id).one
      end

      def published_at_for_id(id)
        posts.dataset.where(id: id).get(:published_at)
      end

      def find_by_ids(ids:)
        return [] if ids.nil? || ids.empty?

        posts.combine(:post_media, :hashtags, :post_mentions).where(id: ids).to_a
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

      def media_ids_of(post_id)
        post_media.dataset.where(post_id: post_id).select_map(:media_id)
      end

      def attached_media_ids(ids)
        post_media.dataset.where(media_id: ids).select_map(:media_id)
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

      def delete_mentions_of(profile_id)
        post_mentions.dataset.where(profile_id: profile_id).delete
      end

      def save_mentions(post_id:, mentions:)
        post_mentions.dataset.where(post_id: post_id).delete
        mentions.each do |mention|
          post_mentions.changeset(
            :create,
            id: SecureRandom.uuid_v7,
            post_id: post_id,
            profile_id: mention[:profile_id],
            position: mention[:position],
            length: mention[:length]
          ).commit
        end
      end

      def list_posts(limit: 20, cursor: nil, author_profile_id: nil, media_only: false, include_private: false, live_only: true)
        scope = posts.combine(:post_media, :hashtags, :post_mentions).exclude(author_profile_id: nil)
        scope = scope.where(visibility: "public") unless include_private
        scope = scope.where(live_condition) if live_only
        scope = scope.where(author_profile_id: author_profile_id) if author_profile_id

        if media_only
          media_post_ids = posts.dataset.db[:post__post_media].select(:post_id).distinct
          scope = scope.where(id: media_post_ids)
        end

        if cursor
          scope = scope.where {
            (published_at < cursor[:published_at]) |
              ((published_at =~ cursor[:published_at]) & (id < cursor[:id]))
          }
        end

        scope.order { [published_at.desc, id.desc] }.limit(limit + 1).to_a
      end

      def list_post_ids(limit: 20, cursor: nil, author_profile_ids: nil, excluded_author_profile_ids: [], include_private: false, viewer_profile_id: nil, private_author_profile_ids: [])
        return [] if !author_profile_ids.nil? && author_profile_ids.empty?

        scope = posts.dataset.where(live_condition)
        unless include_private
          readable = Sequel[visibility: "public"]
          readable |= Sequel[author_profile_id: viewer_profile_id] if viewer_profile_id
          readable |= Sequel[author_profile_id: private_author_profile_ids] unless private_author_profile_ids.empty?
          scope = scope.where(readable)
        end
        scope = scope.where(author_profile_id: author_profile_ids) if author_profile_ids
        scope = scope.exclude(author_profile_id: excluded_author_profile_ids) if excluded_author_profile_ids && !excluded_author_profile_ids.empty?

        if cursor
          scope = scope.where {
            (published_at < cursor[:published_at]) |
              ((published_at =~ cursor[:published_at]) & (id < cursor[:id]))
          }
        end

        scope.order(Sequel.desc(:published_at), Sequel.desc(:id)).limit(limit + 1).select_map(:id).map(&:to_s)
      end

      def find_by_id_and_author(id:, author_profile_id:)
        posts.combine(:post_media, :hashtags, :post_mentions).where(id: id, author_profile_id: author_profile_id).one
      end

      def search_by_content(query:, limit: 20, cursor: nil)
        q = query.to_s.strip
        return [] if q.empty?

        pattern = "%#{q}%"
        scope = posts.dataset.where(visibility: "public").where(live_condition).where(Sequel.lit("content ILIKE ?", pattern))

        newest_ids(scope, limit: limit, cursor: cursor)
      end

      def search_by_hashtag(tag:, limit: 20, cursor: nil)
        t = tag.to_s.strip
        return [] if t.empty?

        tagged = posts.dataset.db[:post__hashtags].where(Sequel.function(:lower, :tag) => t.downcase).select(:post_id)
        scope = posts.dataset.where(visibility: "public").where(live_condition).where(id: tagged)

        newest_ids(scope, limit: limit, cursor: cursor)
      end

      def top_by_likes(period:, limit: 20, cursor: nil)
        ds = posts.dataset.where(visibility: "public").where(live_condition)

        case period.to_s
        when "day"
          ds = ds.where { Sequel[:post__posts][:published_at] >= Sequel.lit("NOW() - INTERVAL '1 day'") }
        when "week"
          ds = ds.where { Sequel[:post__posts][:published_at] >= Sequel.lit("NOW() - INTERVAL '7 days'") }
        when "all"
        else
          return []
        end

        likes_count_expr = Sequel.function(:count, Sequel[:post__likes][:id])

        scope = ds
          .join(:post__likes, post_id: Sequel[:post__posts][:id])
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

      def delete_by_author(profile_id)
        posts.dataset.where(author_profile_id: profile_id).delete
      end

      private

      # Uses the app clock, not SQL now(), so lists agree with FilterVisiblePosts and save validation.
      def live_condition(now = Time.now)
        published_at = Sequel[:post__posts][:published_at]
        expires_at = Sequel[:post__posts][:expires_at]
        (published_at <= now) & (Sequel[expires_at => nil] | (expires_at > now))
      end

      def newest_ids(scope, limit:, cursor:)
        if cursor
          scope = scope.where {
            (published_at < cursor[:published_at]) |
              ((published_at =~ cursor[:published_at]) & (id < cursor[:id]))
          }
        end

        scope.order(Sequel.desc(:published_at), Sequel.desc(:id)).limit(limit + 1).select_map(:id).map(&:to_s)
      end
    end
  end
end
