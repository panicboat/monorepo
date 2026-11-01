# frozen_string_literal: true

require "erb"
require "uri"

module Notifications
  module UseCases
    class BuildPushMessage
      ACTIONS = {
        "like" => "あなたの投稿にいいねしました",
        "comment" => "あなたの投稿にコメントしました",
        "reply" => "あなたのコメントに返信しました",
        "mention" => "あなたをメンションしました",
        "quote" => "あなたの投稿を引用しました",
        "follow_request" => "フォロー申請が届きました",
        "follow" => "あなたをフォローしました"
      }.freeze
      POST_KINDS = %w[like comment reply mention].freeze
      EXCERPT_LIMIT = 100
      # FALLBACK: Open the notification list when the target cannot be addressed.
      FALLBACK_PATH = "/notifications"

      def call(kind:, actor:, recipient:, shared_device:, post_id: nil, thread_id: nil, excerpt: nil)
        {
          title: shared_device ? "#{actor.display_name} → #{recipient.display_name}" : actor.display_name,
          body: body(kind, excerpt),
          url: "/notifications/open?#{URI.encode_www_form(profile: recipient.id, to: path(kind, actor, recipient, post_id, thread_id))}"
        }
      end

      private

      def body(kind, excerpt)
        text = shorten(excerpt)
        return text if kind == "message"

        action = ACTIONS.fetch(kind)
        text.empty? ? action : "#{action}：#{text}"
      end

      def shorten(excerpt)
        text = excerpt.to_s.gsub(/\s+/, " ").strip
        text.length > EXCERPT_LIMIT ? "#{text[0, EXCERPT_LIMIT]}…" : text
      end

      def path(kind, actor, recipient, post_id, thread_id)
        target =
          if POST_KINDS.include?(kind) then post_id && "/posts/#{segment(post_id)}"
          elsif kind == "quote" then post_id && "/posts/#{segment(post_id)}?tab=quotes"
          elsif kind == "follow_request" then recipient.username && "/u/#{segment(recipient.username)}/requests"
          elsif kind == "follow" then actor.username && "/u/#{segment(actor.username)}"
          elsif kind == "message" then thread_id && "/messages/#{segment(thread_id)}"
          end
        target || FALLBACK_PATH
      end

      def segment(value)
        ERB::Util.url_encode(value.to_s)
      end
    end
  end
end
