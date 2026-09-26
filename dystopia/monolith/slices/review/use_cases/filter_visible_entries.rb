# frozen_string_literal: true

module Review
  module UseCases
    class FilterVisibleEntries
      AuthorRef = Struct.new(:author_id)

      include Review::Deps[cast_settings_repo: "repositories.cast_settings_repository"]

      def initialize(cast_settings_repo: nil, block_adapter: nil, filter_visible_posts: nil, **kwargs)
        super(**kwargs.merge(cast_settings_repo: cast_settings_repo).compact)
        @block_adapter = block_adapter
        @filter_visible_posts = filter_visible_posts
      end

      def call(viewer_account_id:, page_owner_account_id:, entries:)
        return entries if viewer_account_id == page_owner_account_id
        return [] if entries.empty?

        visible = entries.reject(&:hidden)
        return [] if visible.empty?

        visible_target_ids = visible.map(&:target_account_id).uniq.select { |id| reviews_visible?(id) }
        visible = visible.select { |e| visible_target_ids.include?(e.target_account_id) }
        return [] if visible.empty?

        return [] unless page_owner_reachable?(viewer_account_id, page_owner_account_id)

        blocked_ids = block_adapter.bidirectionally_blocked_ids(account_id: viewer_account_id)
        visible.reject { |e| blocked_ids.include?(other_party_id(e, page_owner_account_id)) }
      end

      private

      # The target is fixed to the page owner for target lists but varies per entry for author lists.
      def reviews_visible?(target_account_id)
        settings = cast_settings_repo.find_by_account(target_account_id)
        settings.nil? || settings.reviews_visible != false
      end

      def page_owner_reachable?(viewer_account_id, page_owner_account_id)
        filter_visible_posts.call(
          viewer_account_id: viewer_account_id,
          posts: [AuthorRef.new(page_owner_account_id)]
        ).any?
      end

      def other_party_id(entry, page_owner_account_id)
        entry.author_account_id == page_owner_account_id ? entry.target_account_id : entry.author_account_id
      end

      def block_adapter
        @block_adapter ||= Review::Adapters::BlockAdapter.new
      end

      def filter_visible_posts
        @filter_visible_posts ||= ::Social::Slice["use_cases.filter_visible_posts"]
      end
    end
  end
end
