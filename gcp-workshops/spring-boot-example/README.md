# Spring Boot Hello World App

This is a service that accepts some HTTP GET requests on the greeting endpoint and returns a Pokemon by id from a MySQL database.

## Endpoints

### Greeting Endpoint

```sh
curl http://localhost:8080/greeting
```

It will respond with a JSON representation of a greeting.

```json
{ "id": 1, "content": "Hello, World!" }
```

You can customize the greeting with an optional `name` parameter in the query string, as
follows.

```sh
curl http://localhost:8080/greeting?name=User
```

The `name` parameter value overrides the default value of `World` and is reflected in the
response, as the following example shows:

```json
{ "id": 1, "content": "Hello, User!" }
```

### Pokemon Endpoint

You can query a generation 1 Pokemon by it's Kanto Pokedex number.
Use the `id` parameter in the query string, as follows:

```sh
curl http://localhost:8080/pokemon?id=17
```

Response:

```json
{ "id": 17, "name": "Pidgeotto" }
```

## Running the Application

Make sure you have a MySQL database server and database ready and configure it via the `application.properties` file or through the `SPRING_APPLICATION_JSON` environment variable.

```ini
spring.datasource.url=jdbc:mysql://localhost:3306/pokedb?updateDatabaseIfNotExist=true&useSSL=false
spring.datasource.username=tbd
spring.datasource.password=tbd
spring.datasource.initialization-mode=always
spring.jpa.hibernate.ddl-auto=update

spring.jpa.properties.hibernate.dialect = org.hibernate.dialect.MySQL5InnoDBDialect
```

```sh
export SPRING_APPLICATION_JSON='{"spring": {"datasource": { "url": "jdbc:mysql://localhost:3306/pokedb?updateDatabaseIfNotExist=true&useSSL=false","username": "tbd","password": "tbd", "initialization-mode": "always"},"jpa": {"hibernate": {"ddl-auto": "update"},"properties": {"hibernate": {"dialect": "org.hibernate.dialect.MySQL5InnoDBDialect"}}}}}'
```

To start the application execute the Maven script:

```sh
./mvnw spring-boot:run
```

## Credits

This app is originally based on one of the Spring Boot examples at [Spring: Building a RESTful Web Service](https://spring.io/guides/gs/rest-service/#initial)
