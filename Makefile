docker-build:
	docker build -t maintenance-api ./maintenance-api/.

docker-run:
	docker run -p 3000:3000 \
           --env-file ./maintenance-api/.env \
           maintenance-api


.PHONY: docker-build docker-run