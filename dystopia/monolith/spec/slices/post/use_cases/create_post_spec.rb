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

  describe "quoting" do
    let(:block_repo) { Social::Slice["repositories.block_repository"] }
    let(:other) { create_account_with_profile(username: "quote_other") }
    let(:original) { post_repo.create_post(author_profile_id: other, content: "original", visibility: "public") }

    def quote(quoted_post_id, content: "my opinion")
      use_case.call(author_profile_id: author, content: content, quoted_post_id: quoted_post_id)
    end

    def expect_not_quotable(quoted_post_id)
      expect { expect { quote(quoted_post_id) }.to raise_error(invalid, "この投稿は引用できません") }.not_to change { db[:post__posts].where(author_profile_id: author).count }
    end

    it "saves the quoted post id on a public live post" do
      result = quote(original.id)

      expect(result[:post].quoted_post_id).to eq(original.id)
      expect(db[:post__posts].where(id: result[:post].id).get(:quoted_post_id).to_s).to eq(original.id)
    end

    it "leaves the quoted post id empty when no post is quoted" do
      expect(use_case.call(author_profile_id: author, content: "plain")[:post].quoted_post_id).to be_nil
    end

    it "quotes a post of a locked profile" do
      db[:profile__profiles].where(id: other).update(is_private: true)

      expect(quote(original.id)[:post].quoted_post_id).to eq(original.id)
    end

    it "quotes the quoter's own public live post" do
      own = post_repo.create_post(author_profile_id: author, content: "mine", visibility: "public")

      expect(quote(own.id)[:post].quoted_post_id).to eq(own.id)
    end

    it "quotes a post that is itself a quote" do
      first = quote(original.id)[:post]

      expect(quote(first.id)[:post].quoted_post_id).to eq(first.id)
    end

    it "rejects a post that does not exist" do
      expect_not_quotable(SecureRandom.uuid_v7)
    end

    it "rejects a value that is not a UUID" do
      expect_not_quotable("not-a-uuid")
    end

    it "rejects a followers-only post, even the quoter's own" do
      expect_not_quotable(post_repo.create_post(author_profile_id: other, content: "followers", visibility: "private").id)
      expect_not_quotable(post_repo.create_post(author_profile_id: author, content: "mine", visibility: "private").id)
    end

    it "rejects a scheduled post and an expired post, even the quoter's own" do
      [other, author].each do |owner|
        expect_not_quotable(post_repo.create_post(author_profile_id: owner, content: "scheduled", visibility: "public", published_at: Time.now + 3600).id)
        expect_not_quotable(post_repo.create_post(author_profile_id: owner, content: "expired", visibility: "public", published_at: Time.now - 7200, expires_at: Time.now - 3600).id)
      end
    end

    it "rejects a post of a profile in a block relation in either direction" do
      blocker_of_author = create_account_with_profile(username: "quote_blocker")
      blocked_by_author = create_account_with_profile(username: "quote_blocked")
      block_repo.block(blocker_profile_id: blocker_of_author, blocked_profile_id: author)
      block_repo.block(blocker_profile_id: author, blocked_profile_id: blocked_by_author)

      expect_not_quotable(post_repo.create_post(author_profile_id: blocker_of_author, content: "blocked me", visibility: "public").id)
      expect_not_quotable(post_repo.create_post(author_profile_id: blocked_by_author, content: "blocked by me", visibility: "public").id)
    end

    it "requires a body on a quote post" do
      expect { expect { quote(original.id, content: " ") }.to raise_error(invalid, "本文を入力してください") }.not_to change { db[:post__posts].where(author_profile_id: author).count }
    end
  end
end
