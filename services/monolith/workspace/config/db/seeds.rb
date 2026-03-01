# frozen_string_literal: true

# This seeds file creates the database records required to run the app.
# The code is idempotent so that it can be executed at any time.
#
# To load the seeds, run `hanami db seed`. Seeds are also loaded as part of `hanami db prepare`.

require_relative "seeds/helper"

# === Master Data ===
require_relative "seeds/portfolio/areas"
require_relative "seeds/portfolio/genres"

# === Users ===
require_relative "seeds/identity/users"

# === Profiles ===
require_relative "seeds/portfolio/casts"
require_relative "seeds/portfolio/guests"
require_relative "seeds/portfolio/assignments"

# === Offer ===
require_relative "seeds/offer/plans"
require_relative "seeds/offer/schedules"

# === Content ===
require_relative "seeds/post/posts"
require_relative "seeds/post/likes"
require_relative "seeds/post/comments"

# === Relationships ===
require_relative "seeds/relationship/follows"
require_relative "seeds/relationship/blocks"

# === Trust ===
require_relative "seeds/trust/taggings"
require_relative "seeds/trust/reviews"

# === Summary ===
Seeds::Helper.print_summary
