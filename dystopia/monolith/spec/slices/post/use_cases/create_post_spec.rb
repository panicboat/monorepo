# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Post::UseCases::CreatePost", type: :database do
  let(:use_case) { Post::Slice["use_cases.create_post"] }
  let(:post_repo) { Post::Slice["repositories.post_repository"] }
  let(:db) { Hanami.app["db.gateway"].connection }
  let(:author) { create_account_with_profile(username: "post_author") }
  let(:invalid) { Post::UseCases::CreatePost::InvalidPostError }

  it "saves a post with its hashtags" do
    result = use_case.call(author_profile_id: author, content: "hello", hashtags: ["tag"])

    expect(result[:post].content).to eq("hello")
    expect(result[:post].visibility).to eq("public")
    expect(result[:post].hashtags.map(&:tag)).to eq(["tag"])
  end

  it "accepts a body of exactly the maximum length" do
    expect(use_case.call(author_profile_id: author, content: "あ" * 1000)[:post].content.length).to eq(1000)
  end

  it "rejects a body over the maximum length" do
    expect { use_case.call(author_profile_id: author, content: "あ" * 1001) }.to raise_error(invalid, "本文は1000文字以内で入力してください")
    expect(db[:post__posts].where(author_profile_id: author).count).to eq(0)
  end

  it "rejects an unknown visibility" do
    expect { use_case.call(author_profile_id: author, content: "hello", visibility: "secret") }.to raise_error(invalid, "公開範囲が正しくありません")
  end

  it "leaves no post behind when a later step fails" do
    allow(post_repo).to receive(:save_hashtags).and_raise(Sequel::DatabaseError, "boom")
    uc = Post::UseCases::CreatePost.new(post_repo: post_repo)

    db.transaction(savepoint: true, auto_savepoint: true) do
      expect { uc.call(author_profile_id: author, content: "hello", hashtags: ["tag"]) }.to raise_error(Sequel::DatabaseError)
    end

    expect(db[:post__posts].where(author_profile_id: author).count).to eq(0)
  end

  it "does not notify mentions when a later step fails" do
    create_account_with_profile(username: "mentioned_user")
    allow(post_repo).to receive(:save_mentions).and_raise(Sequel::DatabaseError, "boom")
    uc = Post::UseCases::CreatePost.new(post_repo: post_repo)
    expect_any_instance_of(Notifications::UseCases::Emit).not_to receive(:call)

    db.transaction(savepoint: true, auto_savepoint: true) do
      expect { uc.call(author_profile_id: author, content: "hi @mentioned_user") }.to raise_error(Sequel::DatabaseError)
    end
  end
end
