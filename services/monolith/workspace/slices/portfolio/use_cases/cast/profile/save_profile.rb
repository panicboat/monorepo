# frozen_string_literal: true

module Portfolio
  module UseCases
    module Cast
      module Profile
        class SaveProfile
          include Portfolio::Deps[repo: "repositories.cast_repository"]

          def call(user_id:, name:, bio:, tagline: nil, service_category: nil, location_type: nil, area: nil, default_shift_start: nil, default_shift_end: nil, image_path: nil, social_links: nil)
            Hanami.logger.info("SaveProfile Args: tagline=#{tagline}, area=#{area}, service=#{service_category}, social_links=#{social_links}")
            cast = repo.find_by_user_id(user_id)

            attrs = {
              name: name,
              bio: bio,
              tagline: tagline,
              service_category: service_category,
              location_type: location_type,
              area: area,
              default_shift_start: default_shift_start,
              default_shift_end: default_shift_end,
              image_path: image_path,
              social_links: social_links ? Sequel.pg_jsonb(social_links) : nil
            }.compact

            if cast
              repo.update(cast.id, attrs)
            else
              repo.create(
                attrs.merge(
                  user_id: user_id,
                  status: "offline"
                )
              )
            end
          end
        end
      end
    end
  end
end
