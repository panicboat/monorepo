# frozen_string_literal: true

# Feed slice does not have its own database tables.
# It orchestrates Post and Relationship domains.
module Feed
  module DB
    class Repo < Monolith::DB::Repo
    end
  end
end
