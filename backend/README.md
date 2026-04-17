# News Crawler Backend - Phase 1

Spring Boot backend for managing routes and endpoints manually.

## Tech Stack

- Spring Boot
- Maven
- Spring Data JPA (Hibernate)
- MySQL
- Spring Security (HTTP Basic + OWNER role)

## Run

### Option A: Start MySQL with Docker (recommended)

1. Start MySQL:

```bash
docker compose up -d mysql
```

2. Wait until healthy:

```bash
docker compose ps
```

3. Run the backend from this directory:

```bash
mvn spring-boot:run
```

### Option B: Use an existing local MySQL service

1. Ensure MySQL is running on port `3306`.
2. Ensure credentials/database exist:
  - user: `root`
  - password: `root`
  - database: `news_crawler`
3. Run the backend:

```bash
mvn spring-boot:run
```

### Optional environment overrides

You can override datasource settings without editing config:

- `DB_URL`
- `DB_USERNAME`
- `DB_PASSWORD`
- `JPA_DDL_AUTO`

Example (PowerShell):

```powershell
$env:DB_URL="jdbc:mysql://localhost:3306/news_crawler?createDatabaseIfNotExist=true&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC"
$env:DB_USERNAME="root"
$env:DB_PASSWORD="root"
mvn spring-boot:run
```

The app bootstraps one OWNER account on first startup:

- Email: `owner@news.local`
- Password: `change-me`

## APIs

All APIs require HTTP Basic authentication with OWNER credentials.

### Create route

```bash
curl -u owner@news.local:change-me -X POST http://localhost:8080/routes \
  -H "Content-Type: application/json" \
  -d '{"name":"CNN","baseUrl":"https://cnn.com"}'
```

### List routes

```bash
curl -u owner@news.local:change-me http://localhost:8080/routes
```

### Create endpoint

```bash
curl -u owner@news.local:change-me -X POST http://localhost:8080/endpoints \
  -H "Content-Type: application/json" \
  -d '{"url":"https://cnn.com/news","routeId":1,"parentEndpointId":null}'
```

### List endpoints by route

```bash
curl -u owner@news.local:change-me "http://localhost:8080/endpoints?routeId=1"
```