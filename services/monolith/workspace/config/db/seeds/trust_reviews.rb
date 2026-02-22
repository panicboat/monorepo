# frozen_string_literal: true

module Seeds
  class TrustReviews
    def self.call
      db = Hanami.app["db.gateway"].connection

      # Get existing user IDs for seeding (role: 2 = cast, role: 1 = guest)
      cast_user_ids = db[:identity__users].where(role: 2).select_map(:id)
      guest_user_ids = db[:identity__users].where(role: 1).select_map(:id)

      return if cast_user_ids.empty? || guest_user_ids.empty?

      # Check if reviews already exist
      existing_count = db[:trust__reviews].count
      return puts "  Skipped: #{existing_count} reviews already exist" if existing_count > 0

      reviews_data = []

      # Guest -> Cast reviews (pending and approved)
      guest_user_ids.first(3).each_with_index do |guest_id, i|
        cast_user_ids.first(2).each do |cast_id|
          reviews_data << {
            id: SecureRandom.uuid,
            reviewer_id: guest_id,
            reviewee_id: cast_id,
            content: "Great service! Highly recommended. #{i + 1}",
            score: [4, 5].sample,
            status: i.zero? ? "pending" : "approved",
            created_at: Time.now - (i * 86400),
            updated_at: Time.now - (i * 86400)
          }
        end
      end

      # Cast -> Guest reviews (always approved, content optional)
      cast_user_ids.first(2).each do |cast_id|
        guest_user_ids.first(3).each_with_index do |guest_id, i|
          reviews_data << {
            id: SecureRandom.uuid,
            reviewer_id: cast_id,
            reviewee_id: guest_id,
            content: i.even? ? "Good guest, punctual." : nil,
            score: [3, 4, 5].sample,
            status: "approved",
            created_at: Time.now - (i * 86400),
            updated_at: Time.now - (i * 86400)
          }
        end
      end

      db[:trust__reviews].multi_insert(reviews_data)
      puts "  Created #{reviews_data.size} trust reviews"
    end
  end
end
