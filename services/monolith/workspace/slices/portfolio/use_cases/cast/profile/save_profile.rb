# frozen_string_literal: true

module Portfolio
  module UseCases
    module Cast
      module Profile
        class SaveProfile
          class ValidationError < StandardError
            attr_reader :errors

            def initialize(errors)
              @errors = errors
              super(errors.to_h.to_s)
            end
          end

          include Portfolio::Deps[
            repo: "repositories.cast_repository",
            contract: "contracts.cast.save_profile_contract"
          ]

          def call(user_id:, name:, bio:, tagline: nil, service_category: nil, location_type: nil, area: nil, default_schedule_start: nil, default_schedule_end: nil, image_path: nil, social_links: nil)
            # 0. Input Validation
            params = {
              user_id: user_id,
              name: name,
              bio: bio,
              tagline: tagline,
              service_category: service_category,
              location_type: location_type,
              area: area,
              default_schedule_start: default_schedule_start,
              default_schedule_end: default_schedule_end,
              image_path: image_path,
              social_links: social_links
            }.compact

            validation = contract.call(params)
            raise ValidationError, validation.errors unless validation.success?

            Hanami.logger.info("SaveProfile Args: tagline=#{tagline}, area=#{area}, service=#{service_category}, social_links=#{social_links}")
            cast = repo.find_by_user_id(user_id)

            attrs = {
              name: name,
              bio: bio,
              tagline: tagline,
              service_category: service_category,
              location_type: location_type,
              area: area,
              default_schedule_start: default_schedule_start,
              default_schedule_end: default_schedule_end,
              image_path: image_path,
              social_links: social_links ? Sequel.pg_jsonb(social_links) : nil
            }.compact

            if cast
              repo.update(cast.id, attrs)
            else
              repo.create(
                attrs.merge(
                  user_id: user_id,
                  visibility: "unregistered"
                )
              )
            end
          end
        end
      end
    end
  end
end
