# frozen_string_literal: true

module Post
  module UseCases
    module Posts
      class BuildQuoteContext
        include Post::Deps[post_repo: "repositories.post_repository"]
        include Post::Concerns::ProfileAuthorResolvable

        def call(posts:, viewer_profile_id:)
          {
            quotes_counts: post_repo.quotes_count_batch(post_ids: posts.map(&:id), viewer_profile_id: viewer_profile_id),
            quoted_posts: quoted_posts_for(posts, viewer_profile_id)
          }
        end

        private

        def quoted_posts_for(posts, viewer_profile_id)
          originals = post_repo.find_by_ids(ids: posts.filter_map(&:quoted_post_id).uniq)
          originals = visibility_filter.call(viewer_profile_id: viewer_profile_id, posts: originals)
          return {} if originals.empty?

          authors = summarize_profiles.call(profile_ids: originals.map(&:author_profile_id))
          media_files = media_adapter.find_by_ids(originals.flat_map { |original| original.post_media.filter_map(&:media_id) }.uniq)
          schedules = schedule_adapter.find_by_post_ids(originals.map { |original| original.id.to_s })
          mentioned_usernames = mentioned_usernames_for(originals.flat_map { |original| original.post_mentions.map(&:profile_id) })

          originals.to_h do |original|
            frame = Post::Presenters::PostPresenter.to_quoted_post_proto(
              original,
              author: authors[original.author_profile_id.to_s],
              media_files: media_files,
              mentioned_usernames: mentioned_usernames,
              schedules: schedules
            )
            [original.id.to_s, frame]
          end
        end

        def mentioned_usernames_for(profile_ids)
          ids = profile_ids.uniq
          return {} if ids.empty?

          summarize_profiles.call(profile_ids: ids).transform_values(&:username)
        end

        def media_adapter
          @media_adapter ||= Post::Adapters::MediaAdapter.new
        end

        def schedule_adapter
          @schedule_adapter ||= Post::Adapters::ScheduleAdapter.new
        end

        def visibility_filter
          @visibility_filter ||= Social::Slice["use_cases.filter_visible_posts"]
        end
      end
    end
  end
end
