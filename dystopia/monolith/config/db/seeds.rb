# frozen_string_literal: true


require_relative "seeds/helper"

require_relative "seeds/identity/accounts"

require_relative "seeds/profile/profiles"
require_relative "seeds/profile/casts"

require_relative "seeds/karte/access"

require_relative "seeds/social/follows"
require_relative "seeds/social/blocks"

require_relative "seeds/post/posts"
require_relative "seeds/post/likes"
require_relative "seeds/post/comments"

Seeds::Helper.print_summary
