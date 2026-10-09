# frozen_string_literal: true

module Review
  module UseCases
    class FilterVisibleEntries
      AuthorRef = Struct.new(:author_profile_id)

      include Review::Deps[cast_settings_repo: "repositories.cast_settings_repository"]

      def initialize(cast_settings_repo: nil, block_adapter: nil, filter_visible_posts: nil, list_visible_profile_ids: nil, **kwargs)
        super(**kwargs.merge(cast_settings_repo: cast_settings_repo).compact)
        @block_adapter = block_adapter
        @filter_visible_posts = filter_visible_posts
        @list_visible_profile_ids = list_visible_profile_ids
      end

      def call(viewer_profile_id:, page_owner_profile_id:, entries:)
        entries = with_visible_other_party(entries, page_owner_profile_id)
        return entries if viewer_profile_id == page_owner_profile_id
        return [] if entries.empty?

        visible = entries.reject(&:hidden)
        return [] if visible.empty?

        visible_target_ids = visible.map(&:target_profile_id).uniq.select { |id| reviews_visible?(id) }
        visible = visible.select { |e| visible_target_ids.include?(e.target_profile_id) }
        return [] if visible.empty?

        return [] unless page_owner_reachable?(viewer_profile_id, page_owner_profile_id)

        blocked_ids = block_adapter.bidirectionally_blocked_profile_ids(profile_id: viewer_profile_id)
        visible.reject { |e| blocked_ids.include?(other_party_id(e, page_owner_profile_id)) }
      end

      private

      def with_visible_other_party(entries, page_owner_profile_id)
        return entries if entries.empty?

        other_party_ids = entries.map { |e| other_party_id(e, page_owner_profile_id) }
        visible_ids = list_visible_profile_ids.call(profile_ids: other_party_ids)
        entries.select { |e| visible_ids.include?(other_party_id(e, page_owner_profile_id)) }
      end

      def reviews_visible?(target_profile_id)
        settings = cast_settings_repo.find_by_profile(target_profile_id)
        settings.nil? || settings.reviews_visible != false
      end

      def page_owner_reachable?(viewer_profile_id, page_owner_profile_id)
        filter_visible_posts.call(
          viewer_profile_id: viewer_profile_id,
          posts: [AuthorRef.new(page_owner_profile_id)]
        ).any?
      end

      def other_party_id(entry, page_owner_profile_id)
        if entry.author_profile_id == page_owner_profile_id
          entry.target_profile_id
        elsif entry.target_profile_id == page_owner_profile_id
          entry.author_profile_id
        else
          raise ArgumentError, "entry #{entry.id} has neither author nor target matching page_owner_profile_id"
        end
      end

      def block_adapter
        @block_adapter ||= Review::Adapters::BlockAdapter.new
      end

      def filter_visible_posts
        @filter_visible_posts ||= ::Social::Slice["use_cases.filter_visible_posts"]
      end

      def list_visible_profile_ids
        @list_visible_profile_ids ||= ::Profile::Slice["use_cases.list_visible_profile_ids"]
      end
    end
  end
end
