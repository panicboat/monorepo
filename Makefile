.PHONY: push

push:
	@echo "Adding gitea remote..."
	git remote add gitea http://giteaadmin:admin123@localhost:3000/giteaadmin/monorepo.git
	@echo "Pushing to gitea..."
	git push -u gitea main
	@echo "Removing gitea remote..."
	git remote remove gitea
	@echo "Push to gitea completed successfully!"
