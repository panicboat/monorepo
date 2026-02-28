# frozen_string_literal: true

require "errors/validation_error"

module Portfolio
  module UseCases
    module Cast
      module Profile
        class SaveProfile

          include Portfolio::Deps[
            repo: "repositories.cast_repository",
            contract: "contracts.cast.save_profile_contract"
          ]

          class SlugNotAvailableError < StandardError; end

          def call(user_id:, name:, bio:, slug: nil, tagline: nil, default_schedules: nil, social_links: nil, age: nil, height: nil, blood_type: nil, three_sizes: nil, tags: nil, area_ids: nil, genre_ids: nil)
            # 0. Input Validation
            params = {
              user_id: user_id,
              name: name,
              bio: bio,
              slug: slug,
              tagline: tagline,
              default_schedules: default_schedules,
              social_links: social_links,
              age: age,
              height: height,
              blood_type: blood_type,
              three_sizes: three_sizes,
              tags: tags
            }.compact

            validation = contract.call(params)
            raise Errors::ValidationError, validation.errors unless validation.success?

            # Check slug uniqueness
            if slug && !slug.empty? && !repo.slug_available?(slug, exclude_user_id: user_id)
              raise SlugNotAvailableError, "この ID は既に使用されています"
            end

            Hanami.logger.info("SaveProfile Args: tagline=#{tagline}, social_links=#{social_links}")
            cast = repo.find_by_user_id(user_id)

            attrs = {
              name: name,
              bio: bio,
              slug: slug&.downcase,
              tagline: tagline,
              default_schedules: default_schedules ? Sequel.pg_jsonb(default_schedules) : nil,
              social_links: social_links ? Sequel.pg_jsonb(social_links) : nil,
              age: age,
              height: height,
              blood_type: blood_type,
              three_sizes: three_sizes ? Sequel.pg_jsonb(three_sizes) : nil,
              tags: tags ? Sequel.pg_jsonb(tags) : nil
            }.compact

            result = if cast
              repo.update(cast.user_id, attrs)
            else
              repo.create(
                attrs.merge(
                  user_id: user_id,
                  visibility: "public"
                )
              )
            end

            cast_user_id = result.respond_to?(:user_id) ? result.user_id : (cast&.user_id || user_id)

            # Save area associations if provided
            if area_ids && cast_user_id
              repo.save_areas(cast_user_id: cast_user_id, area_ids: area_ids)
            end

            # Save genre associations if provided
            if genre_ids && cast_user_id
              repo.save_genres(cast_user_id: cast_user_id, genre_ids: genre_ids)
            end

            result
          end
        end
      end
    end
  end
end
