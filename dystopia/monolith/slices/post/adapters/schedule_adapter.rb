# frozen_string_literal: true

module Post
  module Adapters
    class ScheduleAdapter
      def find_by_post_ids(post_ids)
        schedule_repo.find_by_post_ids(post_ids: post_ids)
      end

      private

      def schedule_repo
        @schedule_repo ||= Schedule::Slice["repositories.schedule_repository"]
      end
    end
  end
end
