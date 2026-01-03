module Cast
  module Services
    class CreateProfile
      include Cast::Deps[repo: "repositories.cast_repo"]

      def call(user_id:, name:, bio:, image_url:, plans: [])
        # TODO: Validation

        cast_data = {
          user_id: user_id,
          name: name,
          bio: bio,
          image_url: image_url,
          status: 'offline',
          promise_rate: 1.0,
          created_at: Time.now,
          updated_at: Time.now
        }

        plans_data = plans.map do |plan|
          {
            name: plan[:name],
            price: plan[:price],
            duration_minutes: plan[:duration_minutes],
            created_at: Time.now,
            updated_at: Time.now
          }
        end

        # Use repo transaction method
        repo.create_with_plans(cast_data, plans_data)
      end
    end
  end
end
