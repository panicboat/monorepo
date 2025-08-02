.PHONY: push deploy gitea

push:
	@echo "Adding gitea remote..."
	git remote add gitea http://giteaadmin:admin123@localhost:3000/giteaadmin/monorepo.git
	@echo "Pushing to gitea..."
	git push -u gitea main
	@echo "Removing gitea remote..."
	git remote remove gitea
	@echo "Push to gitea completed successfully!"

deploy:
	@echo "Applying Kubernetes manifests..."
	kubectl apply -k clusters/local
	@echo "Deployment completed successfully!"
	flux get kustomizations

gitea: push deploy
