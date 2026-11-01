# frozen_string_literal: true

module Report
  module UseCases
    class LoadTarget
      TARGET_TYPES = %w[post comment message review karte profile].freeze

      Target = Data.define(:reported_account_id, :reported_profile_id, :content)

      def call(target_type:, target_id:, viewer_account_id:, viewer_profile_id:)
        case target_type
        when "post" then load_post(target_id, viewer_profile_id)
        when "comment" then load_comment(target_id, viewer_profile_id)
        when "message" then load_message(target_id, viewer_profile_id)
        when "review" then load_review(target_id, viewer_account_id, viewer_profile_id)
        when "karte" then load_karte(target_id, viewer_account_id)
        when "profile" then load_profile(target_id)
        end
      end

      private

      def load_post(post_id, viewer_profile_id)
        return unless post_readable?(post_id, viewer_profile_id)

        post = post_repo.find_by_id(post_id)
        written_by(post.author_profile_id, post.content)
      end

      def load_comment(comment_id, viewer_profile_id)
        comment = comment_repo.find_by_id(comment_id)
        return unless comment && post_readable?(comment.post_id, viewer_profile_id)

        written_by(comment.author_profile_id, comment.content)
      end

      def load_message(message_id, viewer_profile_id)
        message = messaging_repo.find_message(id: message_id)
        thread = message && messaging_repo.find_thread(id: message.thread_id)
        return unless thread && [thread.profile_a, thread.profile_b].include?(viewer_profile_id)

        written_by(message.sender_profile_id, message.content)
      end

      def load_review(review_id, viewer_account_id, viewer_profile_id)
        presented = ::Review::Slice["use_cases.get_review"].call(viewer_account_id: viewer_account_id, viewer_profile_id: viewer_profile_id, review_id: review_id)
        review = ::Review::Slice["repositories.review_repository"].find(review_id)
        Target.new(reported_account_id: review.author_account_id, reported_profile_id: review.author_profile_id, content: record_text(review.rating, presented[:events]))
      rescue ::Review::Errors::Invalid
        nil
      end

      def load_karte(karte_id, viewer_account_id)
        presented = ::Karte::Slice["use_cases.get_karte"].call(viewer_account_id: viewer_account_id, karte_id: karte_id)
        karte = ::Karte::Slice["repositories.karte_repository"].find(karte_id)
        Target.new(reported_account_id: karte.author_account_id, reported_profile_id: karte.author_profile_id, content: record_text(karte.rating, presented[:events]))
      rescue ::Karte::Errors::Forbidden, ::Karte::Errors::Invalid
        nil
      end

      def load_profile(profile_id)
        profile = ::Profile::Slice["use_cases.get_profile"].call(profile_id: profile_id)
        return unless profile

        Target.new(reported_account_id: profile.account_id, reported_profile_id: profile.id, content: [profile.display_name, profile.bio].compact.join("\n"))
      end

      def written_by(profile_id, content)
        Target.new(reported_account_id: account_id_of(profile_id), reported_profile_id: profile_id, content: content)
      end

      def account_id_of(profile_id)
        return unless profile_id

        ::Profile::Slice["repositories.profile_repository"].find_by_id(profile_id)&.account_id
      end

      def record_text(rating, events)
        lines = events.map { |event| [event[:occurred_on], event[:stage], event[:outcome], event[:tags].join(","), event[:note]].join(" ") }
        ["rating: #{rating}", *lines].join("\n")
      end

      def post_readable?(post_id, viewer_profile_id)
        ::Post::Slice["use_cases.posts.list_readable_post_ids"].call(post_ids: [post_id], viewer_profile_id: viewer_profile_id).any?
      end

      def post_repo
        ::Post::Slice["repositories.post_repository"]
      end

      def comment_repo
        ::Post::Slice["repositories.comment_repository"]
      end

      def messaging_repo
        ::Messaging::Slice["repositories.messaging_repository"]
      end
    end
  end
end
