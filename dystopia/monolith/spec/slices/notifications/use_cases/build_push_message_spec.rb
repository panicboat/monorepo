# frozen_string_literal: true

require "spec_helper"

RSpec.describe Notifications::UseCases::BuildPushMessage do
  let(:build) { described_class.new }
  let(:push_profile) { Notifications::Adapters::ProfileAdapter::PushProfile }
  let(:actor) { push_profile.new(id: "actor-1", account_id: "account-a", username: "rin", display_name: "りん") }
  let(:recipient) { push_profile.new(id: "recipient-1", account_id: "account-b", username: "yuna", display_name: "ゆな") }

  def message(kind, shared_device: false, actor: self.actor, recipient: self.recipient, **rest)
    build.call(kind: kind, actor: actor, recipient: recipient, shared_device: shared_device, **rest)
  end

  def destination(result)
    uri = URI(result[:url])
    [uri.path, URI.decode_www_form(uri.query).to_h]
  end

  it "describes each kind with the in-app wording" do
    {
      "like" => "あなたの投稿にいいねしました",
      "comment" => "あなたの投稿にコメントしました",
      "reply" => "あなたのコメントに返信しました",
      "mention" => "あなたをメンションしました",
      "quote" => "あなたの投稿を引用しました",
      "follow_request" => "フォロー申請が届きました",
      "follow" => "あなたをフォローしました"
    }.each do |kind, body|
      expect(message(kind, post_id: "post-1")).to include(title: "りん", body: body)
    end
  end

  it "adds the text after the action for comments, replies, mentions and quotes" do
    expect(message("comment", post_id: "post-1", excerpt: "かわいい")[:body]).to eq("あなたの投稿にコメントしました：かわいい")
    expect(message("reply", post_id: "post-1", excerpt: "ありがとう")[:body]).to eq("あなたのコメントに返信しました：ありがとう")
    expect(message("mention", post_id: "post-1", excerpt: "@yuna またね")[:body]).to eq("あなたをメンションしました：@yuna またね")
    expect(message("quote", post_id: "post-1", excerpt: "同感です")[:body]).to eq("あなたの投稿を引用しました：同感です")
  end

  it "shows only the text of a direct message" do
    expect(message("message", thread_id: "thread-1", excerpt: "明日空いてますか？")[:body]).to eq("明日空いてますか？")
  end

  it "cuts the text at 100 characters with an ellipsis" do
    expect(message("message", thread_id: "thread-1", excerpt: "あ" * 100)[:body]).to eq("あ" * 100)
    expect(message("message", thread_id: "thread-1", excerpt: "あ" * 101)[:body]).to eq("#{'あ' * 100}…")
  end

  it "puts multi-line text on one line and drops text that is only whitespace" do
    expect(message("comment", post_id: "post-1", excerpt: "一行目\n\n  二行目 ")[:body]).to eq("あなたの投稿にコメントしました：一行目 二行目")
    expect(message("comment", post_id: "post-1", excerpt: " \n ")[:body]).to eq("あなたの投稿にコメントしました")
  end

  it "names the receiving profile when the device holds more than one" do
    expect(message("like", post_id: "post-1", shared_device: true)[:title]).to eq("りん → ゆな")
  end

  it "opens the target through the handoff page as the receiving profile" do
    expect(destination(message("like", post_id: "post-1"))).to eq(["/notifications/open", { "profile" => "recipient-1", "to" => "/posts/post-1" }])
    expect(destination(message("mention", post_id: "post-2"))[1]["to"]).to eq("/posts/post-2")
    expect(destination(message("quote", post_id: "post-3"))[1]["to"]).to eq("/posts/post-3?tab=quotes")
    expect(destination(message("follow_request"))[1]["to"]).to eq("/u/yuna/requests")
    expect(destination(message("follow"))[1]["to"]).to eq("/u/rin")
    expect(destination(message("message", thread_id: "thread-1", excerpt: "hi"))[1]["to"]).to eq("/messages/thread-1")
  end

  it "opens the notification list when the target cannot be addressed" do
    nameless = push_profile.new(id: "recipient-1", account_id: "account-b", username: nil, display_name: "ゆな")

    expect(destination(message("follow_request", recipient: nameless))[1]["to"]).to eq("/notifications")
    expect(destination(message("like"))[1]["to"]).to eq("/notifications")
    expect(destination(message("quote"))[1]["to"]).to eq("/notifications")
  end
end
