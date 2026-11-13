# BookNest API

BookNest is a backend-only bookstore API built as a modular monolith. The
application uses clear module boundaries for users, authentication, books,
shopping carts, orders, payments, and health checks.

## Technologies

- Node.js 24
- Express 5
- MongoDB 8
- Mongoose
- Joi
- JWT authentication
- Docker and Docker Compose
- Node.js built-in test runner

## Prerequisites

- [Git](https://git-scm.com/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) with
  Docker Compose support

## Installation and setup

Clone the repository and enter the project directory:

```bash
git clone <repository-url>
cd BookNest
```

The repository does not currently include an `.env.example` file. Docker
Compose expects the following values to be supplied from a local `.env` file:

```env
JWT_SECRET=replace-with-a-local-secret
JWT_EXPIRES_IN=1d
```

Do not commit `.env` or real secrets. The Compose file supplies the container
values for `MONGODB_URI`, `PORT`, and `NODE_ENV` automatically:

- `MONGODB_URI=mongodb://mongodb:27017/booknest`
- `PORT=3000`
- `NODE_ENV=development`

The optional admin seeding script also reads `ADMIN_NAME`, `ADMIN_EMAIL`, and
`ADMIN_PASSWORD` when it is run.

## Run with Docker Compose

Build the API image and start the API and MongoDB services:

```bash
docker compose up --build
```

The API is available at `http://localhost:3000`.

Verify that the API is running:

```bash
curl http://localhost:3000/health
```

The expected response is:

```json
{"status":"ok"}
```

### Useful Docker Compose commands

Show running services:

```bash
docker compose ps
```

Follow service logs:

```bash
docker compose logs -f
```

Stop and remove the application containers:

```bash
docker compose down
```

## Run tests

Install the project's dependencies in a local Node.js environment, then run:

```bash
npm test
```

Database-backed tests require the test database configuration used by the
project, including `MONGODB_TEST_URI` pointing to the expected
`booknest_test` database.

## API documentation

- OpenAPI specification: [`openapi.yaml`](./openapi.yaml)
- SwaggerHub documentation URL: _to be added_
