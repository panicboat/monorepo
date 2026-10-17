# frozen_string_literal: true

module Social
  module UseCases
    class ViewerCanSeePost
      include Social::Deps[filter_visible_posts: "use_cases.filter_visible_posts"]

      def call(viewer_profile_id:, post:)
        filter_visible_posts.call(viewer_profile_id: viewer_profile_id, posts: [post]).any?
      end
    end
  end
end
