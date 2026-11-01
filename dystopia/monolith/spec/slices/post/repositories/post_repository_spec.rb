# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Post::Repositories::PostRepository", type: :database do
  let(:repo) { Hanami.app.slices[:post]["repositories.post_repository"] }
  let(:cast_id) { SecureRandom.uuid_v7 }
  let(:like_repo) { Post::Slice["repositories.like_repository"] }

  describe "#create_post" do
    it "creates a post and returns it" do
      post = repo.create_post(author_profile_id: cast_id, content: "Hello world")
      expect(post.author_profile_id).to eq(cast_id)
      expect(post.content).to eq("Hello world")
      expect(post.id).not_to be_nil
    end
  end

  describe "#search_by_hashtag" do
    def tagged_post(content, tags, visibility: "public")
      post = repo.create_post(author_profile_id: cast_id, content: content, visibility: visibility)
      repo.save_hashtags(post_id: post.id, hashtags: tags)
      post.id
    end

    it "finds the public posts that carry exactly that tag, whatever its case" do
      exact = tagged_post("a #NewLook", ["NewLook"])
      tagged_post("a #NewLookBook", ["NewLookBook"])
      tagged_post("no tag at all, only the words newlook", [])
      tagged_post("a private #newlook", ["newlook"], visibility: "private")

      expect(repo.search_by_hashtag(tag: "newlook")).to eq([exact])
    end

    it "finds a tag written in Japanese" do
      id = tagged_post("今日の #新作", ["新作"])
      tagged_post("今日の #新作コスメ", ["新作コスメ"])

      expect(repo.search_by_hashtag(tag: "新作")).to eq([id])
    end

    it "lists a post once even when the tag was saved on it twice" do
      id = tagged_post("#a and #A", ["a", "A"])

      expect(repo.search_by_hashtag(tag: "a")).to eq([id])
    end

    it "returns nothing for an empty tag" do
      tagged_post("a #tag", ["tag"])

      expect(repo.search_by_hashtag(tag: " ")).to eq([])
    end
  end

  describe "#search_by_content" do
    it "matches % and _ in the query literally" do
      literal = repo.create_post(author_profile_id: cast_id, content: "100%_sure", visibility: "public")
      other = repo.create_post(author_profile_id: cast_id, content: "100 sure", visibility: "public")

      expect(repo.search_by_content(query: "100%_")).to eq([literal.id])
      expect(repo.search_by_content(query: "100_")).not_to include(other.id)
    end
  end

  describe "#find_by_id" do
    it "returns nil when post does not exist" do
      expect(repo.find_by_id(SecureRandom.uuid_v7)).to be_nil
    end

    it "returns post with media when exists" do
      post = repo.create_post(author_profile_id: cast_id, content: "Test")
      result = repo.find_by_id(post.id)
      expect(result).not_to be_nil
      expect(result.content).to eq("Test")
    end
  end

  describe "#update_post" do
    it "updates post content" do
      post = repo.create_post(author_profile_id: cast_id, content: "Original")
      result = repo.update_post(post.id, content: "Updated")
      expect(result.content).to eq("Updated")
    end
  end

  describe "#delete_post" do
    it "deletes the post" do
      post = repo.create_post(author_profile_id: cast_id, content: "To delete")
      repo.delete_post(post.id)
      expect(repo.find_by_id(post.id)).to be_nil
    end
  end

  describe "#quotes_count_batch" do
    let(:db) { Hanami.app["db.gateway"].connection }
    let(:author) { create_account_with_profile(username: "count_author") }
    let(:viewer) { create_account_with_profile(username: "count_viewer") }
    let(:first_original) { repo.create_post(author_profile_id: author, content: "first", visibility: "public") }
    let(:second_original) { repo.create_post(author_profile_id: author, content: "second", visibility: "public") }

    def quote(original, **attributes)
      repo.create_post(author_profile_id: author, content: "take", visibility: "public", quoted_post_id: original.id, **attributes)
    end

    it "groups the counts by original and leaves out originals without visible quotes" do
      2.times { quote(first_original) }
      quote(second_original)
      unquoted = repo.create_post(author_profile_id: author, content: "unquoted", visibility: "public")

      counts = repo.quotes_count_batch(post_ids: [first_original.id, second_original.id, unquoted.id], viewer_profile_id: viewer)

      expect(counts).to eq(first_original.id => 2, second_original.id => 1)
    end

    it "returns an empty hash without post ids" do
      expect(repo.quotes_count_batch(post_ids: [], viewer_profile_id: viewer)).to eq({})
    end

    it "counts neither authorless nor followers only quotes for no viewer" do
      quote(first_original)
      quote(first_original, visibility: "private")
      quote(first_original, author_profile_id: nil)

      expect(repo.quotes_count_batch(post_ids: [first_original.id], viewer_profile_id: nil)).to eq(first_original.id => 1)
    end

    it "does not load the quote rows" do
      quote(first_original)
      viewer
      log = StringIO.new
      logger = Logger.new(log)
      db.loggers << logger

      begin
        repo.quotes_count_batch(post_ids: [first_original.id], viewer_profile_id: viewer)
      ensure
        db.loggers.delete(logger)
      end

      expect(log.string.lines.length).to eq(1)
      expect(log.string).to include("GROUP BY").and include("count(*)")
    end
  end

  describe "#list_quotes" do
    let(:author) { create_account_with_profile(username: "list_quotes_author") }
    let(:original) { repo.create_post(author_profile_id: author, content: "original", visibility: "public") }
    let(:now) { Time.now }

    def quote(published_at)
      repo.create_post(author_profile_id: author, content: "take", visibility: "public", published_at: published_at, quoted_post_id: original.id)
    end

    it "returns limit + 1 quotes of that post, newest first, with equal times by id descending" do
      oldest = quote(now - 300)
      tied = [quote(now - 200), quote(now - 200)]
      repo.save_hashtags(post_id: oldest.id, hashtags: ["kept"])
      repo.create_post(author_profile_id: author, content: "plain", visibility: "public", published_at: now - 100)

      rows = repo.list_quotes(post_id: original.id, limit: 2, cursor: nil)

      expect(rows.map(&:id)).to eq([*tied.map(&:id).sort.reverse, oldest.id])
      expect(rows.last.hashtags.map(&:tag)).to eq(["kept"])
    end

    it "continues after the cursor" do
      older = quote(now - 300)
      newer = quote(now - 200)

      rows = repo.list_quotes(post_id: original.id, limit: 2, cursor: { published_at: newer.published_at, id: newer.id })

      expect(rows.map(&:id)).to eq([older.id])
    end
  end

  describe "#save_media" do
    let(:media_repo) { Hanami.app.slices[:media]["repositories.media_repository"] }

    def create_media_file(media_type: "image")
      media_id = SecureRandom.uuid_v7
      media_repo.create(
        id: media_id,
        media_type: media_type,
        media_key: "uploads/#{media_id}.jpg"
      )
      media_id
    end

    it "saves media with media_id for a post" do
      post = repo.create_post(author_profile_id: cast_id, content: "With media")
      media_id = create_media_file(media_type: "image")
      media_data = [
        { media_id: media_id, media_type: "image" }
      ]
      repo.save_media(post_id: post.id, media_data: media_data)

      result = repo.find_by_id(post.id)
      expect(result.post_media.size).to eq(1)
      expect(result.post_media.first.media_id).to eq(media_id)
      expect(result.post_media.first.media_type).to eq("image")
    end

    it "saves multiple media with media_ids preserving position" do
      post = repo.create_post(author_profile_id: cast_id, content: "With media")
      media_id1 = create_media_file(media_type: "image")
      media_id2 = create_media_file(media_type: "video")
      media_data = [
        { media_id: media_id1, media_type: "image" },
        { media_id: media_id2, media_type: "video" }
      ]
      repo.save_media(post_id: post.id, media_data: media_data)

      result = repo.find_by_id(post.id)
      expect(result.post_media.size).to eq(2)
      sorted_media = result.post_media.sort_by(&:position)
      expect(sorted_media[0].media_id).to eq(media_id1)
      expect(sorted_media[0].position).to eq(0)
      expect(sorted_media[1].media_id).to eq(media_id2)
      expect(sorted_media[1].position).to eq(1)
    end

    it "replaces existing media" do
      post = repo.create_post(author_profile_id: cast_id, content: "With media")
      old_media_id = create_media_file(media_type: "image")
      new_media_id = create_media_file(media_type: "video")

      repo.save_media(post_id: post.id, media_data: [{ media_id: old_media_id, media_type: "image" }])
      repo.save_media(post_id: post.id, media_data: [{ media_id: new_media_id, media_type: "video" }])

      result = repo.find_by_id(post.id)
      expect(result.post_media.size).to eq(1)
      expect(result.post_media.first.media_id).to eq(new_media_id)
      expect(result.post_media.first.media_type).to eq("video")
    end
  end

  describe "#save_hashtags" do
    it "saves hashtags for a post" do
      post = repo.create_post(author_profile_id: cast_id, content: "Post with hashtags")
      repo.save_hashtags(post_id: post.id, hashtags: ["ruby", "rails"])

      result = repo.find_by_id(post.id)
      expect(result.hashtags.map(&:tag)).to contain_exactly("ruby", "rails")
    end

    it "replaces existing hashtags" do
      post = repo.create_post(author_profile_id: cast_id, content: "Post")
      repo.save_hashtags(post_id: post.id, hashtags: ["old"])
      repo.save_hashtags(post_id: post.id, hashtags: ["new"])

      result = repo.find_by_id(post.id)
      expect(result.hashtags.map(&:tag)).to eq(["new"])
    end
  end

  describe "#save_mentions" do
    it "saves mentions for a post" do
      post = repo.create_post(author_profile_id: cast_id, content: "@alice hi")
      mentioned_id = SecureRandom.uuid_v7
      repo.save_mentions(post_id: post.id, mentions: [{ profile_id: mentioned_id, position: 0, length: 6 }])

      result = repo.find_by_id(post.id)
      expect(result.post_mentions.length).to eq(1)
      expect(result.post_mentions.first.profile_id).to eq(mentioned_id)
      expect(result.post_mentions.first.position).to eq(0)
      expect(result.post_mentions.first.length).to eq(6)
    end

    it "replaces existing mentions" do
      post = repo.create_post(author_profile_id: cast_id, content: "@a @b")
      id_a = SecureRandom.uuid_v7
      id_b = SecureRandom.uuid_v7
      repo.save_mentions(post_id: post.id, mentions: [{ profile_id: id_a, position: 0, length: 2 }])
      repo.save_mentions(post_id: post.id, mentions: [{ profile_id: id_b, position: 3, length: 2 }])

      result = repo.find_by_id(post.id)
      expect(result.post_mentions.map(&:profile_id)).to eq([id_b])
    end
  end

  describe "author-based queries (symmetric)" do
    let(:author_profile_id) { SecureRandom.uuid_v7 }

    it "creates a post with author_profile_id and finds it" do
      created = repo.create_post(author_profile_id: author_profile_id, content: "hello", visibility: "public")
      found = repo.find_by_id_and_author(id: created.id, author_profile_id: author_profile_id)
      expect(found).not_to be_nil
      expect(found.content).to eq("hello")
    end

    it "lists public posts by author_profile_id" do
      repo.create_post(author_profile_id: author_profile_id, content: "p1", visibility: "public")
      repo.create_post(author_profile_id: author_profile_id, content: "p2", visibility: "private")
      result = repo.list_posts(author_profile_id: author_profile_id)
      expect(result.map(&:content)).to include("p1")
      expect(result.map(&:content)).not_to include("p2")
    end
  end

  describe "#top_by_likes" do
    it "leaves out posts nobody has liked in every period" do
      liked = repo.create_post(author_profile_id: cast_id, content: "liked", visibility: "public")
      unliked = repo.create_post(author_profile_id: cast_id, content: "unliked", visibility: "public")
      like_repo.profile_like(post_id: liked.id, profile_id: SecureRandom.uuid_v7)

      %w[day week all].each do |period|
        ranked = repo.top_by_likes(period: period).map(&:first)
        expect(ranked).to include(liked.id)
        expect(ranked).not_to include(unliked.id)
      end
    end

    it "orders by likes and pages through them without gaps or repeats" do
      posts = Array.new(3) { |i| repo.create_post(author_profile_id: cast_id, content: "p#{i}", visibility: "public") }
      posts.each_with_index { |post, i| (i + 1).times { like_repo.profile_like(post_id: post.id, profile_id: SecureRandom.uuid_v7) } }

      first = repo.top_by_likes(period: "all", limit: 2)
      second = repo.top_by_likes(period: "all", limit: 2, cursor: { likes: first[1][1], id: first[1][0] })

      expect(first.first(2).map(&:first) + second.map(&:first)).to eq(posts.reverse.map(&:id))
    end

    it "does not raise an ambiguous column error for day and week periods" do
      repo.create_post(author_profile_id: cast_id, content: "ranked", visibility: "public")

      %w[day week all].each do |period|
        expect { repo.top_by_likes(period: period, limit: 10) }.not_to raise_error
      end
    end
  end

  describe "#delete_by_author" do
    it "deletes all posts by the author" do
      author_profile_id = SecureRandom.uuid_v7
      other_author_profile_id = SecureRandom.uuid_v7
      mine = repo.create_post(author_profile_id: author_profile_id, content: "mine")
      other = repo.create_post(author_profile_id: other_author_profile_id, content: "not mine")

      repo.delete_by_author(author_profile_id)

      expect(repo.find_by_id(mine.id)).to be_nil
      expect(repo.find_by_id(other.id)).not_to be_nil
    end
  end

  describe "display window" do
    let(:now) { Time.now }
    let!(:live) { repo.create_post(author_profile_id: cast_id, content: "window live #w", visibility: "public", published_at: now - 3600, expires_at: now + 3600) }
    let!(:scheduled) { repo.create_post(author_profile_id: cast_id, content: "window scheduled #w", visibility: "public", published_at: now + 3600) }
    let!(:expired) { repo.create_post(author_profile_id: cast_id, content: "window expired #w", visibility: "public", published_at: now - 7200, expires_at: now - 3600) }

    before do
      [live, scheduled, expired].each do |post|
        repo.save_hashtags(post_id: post.id, hashtags: ["w"])
        like_repo.profile_like(post_id: post.id, profile_id: SecureRandom.uuid_v7)
      end
    end

    it "keeps feeds, search, hashtags and ranking to live posts" do
      expect(repo.list_post_ids(viewer_profile_id: cast_id)).to eq([live.id])
      expect(repo.search_by_content(query: "window")).to eq([live.id])
      expect(repo.search_by_hashtag(tag: "w")).to eq([live.id])
      expect(repo.top_by_likes(period: "all").map(&:first)).to eq([live.id])
    end

    it "keeps the profile list to live posts unless it lists every post" do
      expect(repo.list_posts(author_profile_id: cast_id).map(&:id)).to eq([live.id])
      expect(repo.list_posts(author_profile_id: cast_id, live_only: false).map(&:id)).to eq([scheduled.id, live.id, expired.id])
    end

    it "ranks by the display start for a period" do
      late = repo.create_post(author_profile_id: cast_id, content: "late", visibility: "public", published_at: now - 60, created_at: now - (10 * 86_400))
      early = repo.create_post(author_profile_id: cast_id, content: "early", visibility: "public", published_at: now - (3 * 86_400))
      [late, early].each { |post| like_repo.profile_like(post_id: post.id, profile_id: SecureRandom.uuid_v7) }

      day = repo.top_by_likes(period: "day").map(&:first)

      expect(day).to include(late.id, live.id)
      expect(day).not_to include(early.id)
    end

    it "orders the feed by the display start and pages through equal starts without gaps or repeats" do
      shared = now - 60
      tied = Array.new(3) { repo.create_post(author_profile_id: cast_id, content: "tied", visibility: "public", published_at: shared) }
      newest = repo.create_post(author_profile_id: cast_id, content: "newest", visibility: "public", published_at: now - 30, created_at: now - 86_400)

      ids = []
      cursor = nil
      loop do
        page = repo.list_post_ids(limit: 2, cursor: cursor, viewer_profile_id: cast_id)
        ids.concat(page.first(2))
        break if page.length <= 2

        cursor = { published_at: repo.published_at_for_id(page[1]), id: page[1] }
      end

      expect(ids).to eq([newest.id, *tied.map(&:id).sort.reverse, live.id])
    end

    it "orders search and hashtags by the display start and pages through equal starts without gaps or repeats" do
      shared = now - 60
      tied = Array.new(3) do
        repo.create_post(author_profile_id: cast_id, content: "window tied #w", visibility: "public", published_at: shared).tap { |post| repo.save_hashtags(post_id: post.id, hashtags: ["w"]) }
      end
      newest = repo.create_post(author_profile_id: cast_id, content: "window newest #w", visibility: "public", published_at: now - 30, created_at: now - 86_400)
      repo.save_hashtags(post_id: newest.id, hashtags: ["w"])
      expected = [newest.id, *tied.map(&:id).sort.reverse, live.id]

      page_through = lambda do |search|
        ids = []
        cursor = nil
        loop do
          page = search.call(cursor)
          ids.concat(page.first(2))
          break if page.length <= 2

          cursor = { published_at: repo.published_at_for_id(page[1]), id: page[1] }
        end
        ids
      end

      expect(page_through.call(->(cursor) { repo.search_by_content(query: "window", limit: 2, cursor: cursor) })).to eq(expected)
      expect(page_through.call(->(cursor) { repo.search_by_hashtag(tag: "w", limit: 2, cursor: cursor) })).to eq(expected)
    end
  end
end
