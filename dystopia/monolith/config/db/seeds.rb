# frozen_string_literal: true


require_relative "seeds/helper"

require_relative "seeds/identity/accounts"

require_relative "seeds/profile/profiles"
require_relative "seeds/profile/casts"

require_relative "seeds/social/follows"
require_relative "seeds/social/blocks"

require_relative "seeds/post/posts"
require_relative "seeds/schedule/schedules"
require_relative "seeds/post/likes"
require_relative "seeds/post/comments"

require_relative "seeds/bookmarks/bookmarks"
require_relative "seeds/footprints/visits"
require_relative "seeds/messaging/threads"

require_relative "seeds/karte/kartes"
require_relative "seeds/review/reviews"

require_relative "seeds/notifications/notifications"
require_relative "seeds/report/reports"

Seeds::Helper.print_summary
