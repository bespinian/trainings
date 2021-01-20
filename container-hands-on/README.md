# Docker Hands-On Session

## Run your first container

Run your first container by executing

```sh
docker run hello-world
```

This will download the hello-world image from the Docker Hub image
registry and run it. It just prints a friendly message and exits.

However, the container is still present. Use the following command to
display all containers.

```sh
docker ps -a
```

## Running a simple webserver

The bespinian awesome image hosts a static website using nginx which
listens on port 8080. To be able to access it, we'll need to map a host
port to the container port.
Run the following command to run it and access the awesome website on
http://localhost:8080.

```sh
docker run -p 8080:8080 -e APP_TITLE=PARTY \
    -e DB_HOST=tbd:27017 -e APP_VERSION=1337 \
    bespinian/awesome-image
```

The `-p` option tells docker to expose a container port on a host port.

You may have noticed we used the `-e` option to set environment variables
in the container. The awesome image reads them to transform the index.html
into something slightly customized.

Tear your container down with the following commands.

```sh
docker stop { container_name | container_id}
docker rm { container_name | container_id}
```

You can find the name and id using `docker ps`.

Now try hosting it on a different port by changing the the input for the
`-p` option as `-p 8081:8080` and access it through http://localhost:8081.

# Run a container in the background

To avoid the container blocking your console start it using the "detach"
option `-d` or `--detach`

Tear your old container down and start a new one with the same command but
also add the `-d` option.

> Tipp!
>
> You can use force remove to directly remove containers
> that are still running with a single command by running
>
> ```sh
> docker rm -f { container_name | container_id }
> ```

Make a few requests, and notice how the request log entries
don't show up in your terminal anymore.
Use `docker logs { container_id | container_name }` to review what that
container has printed to the standard output.

> Tipp!
>
> Add the `-f` and / or `--tail n` options to to logs command follow the
> log and or see only the last n rows

# Building container images

Bespinain has prepared a very small, awesome node application with a
Dockerfile.

Pull the repository from https://github.com/bespinian/awesome-node and
run the following command with your
terminal location insidee the repo to build a container image.

Run `docker build -t awesome-node .`

Docker builds the image according to the instructions within
the Dockerfile (located in current directory according to the "." period
sign) and names it 'awesome-node' according to the `-t` option.

Notice how you never had to install any nodejs runtime or
tooling. It's all there inside the base image and it's
possible to specify a specific base image version using
a desired version of NodeJS too by changing the "lts" tag.

You can find available NodeJS docker images on
[Docker Hub](https://hub.docker.com/_/node/).

Now run your newly built image and expose the container port 8080 on a
local port with the following command.

```sh
docker run -p 8080:8080 -d awesome-node
```

Access the app's two endpoints on http://localhost:8080 and
http://localhost:8080/random-nr

# See layers in action

Make a change (e.g. replace the random nr. with something
actually random: `Math.floor(Math.random()*1000)` in the
code and rebuild it.

Notice how the build output will say

```
CACHED [2/5] ...
CACHED [3/5] ...
CACHED [4/5] ...
```

Those layers are not built again since there was no change in
the relevant build context (our dependency manifest package-lock.json)
or the layers below.

It is best practice to put things that rarely change and have
a big impact on build times, such as installation of
dependencies into lower layers.

If you look into the Dockerfile you will see, that we copied only our
dependency manifest files `package.json` and `package-lock.json*`
at first creating a single layer, then ran `npm install` creating
the next layer and only then in a further steps loaded in our
application source code.

# Mount a local directory into your container

To share local files you can mount a local directory (or single file)
into your container. This is called a host volume.

We'll use nginx as static server but want it to serve our local directory.
By default it just serves a "Welcome to nginx" landing page.
Download the file `index.html` from the course resources folder
into your current directory.

Run the nginx container image with the directory mounted to the
html directory of nginx in the container.

```sh
docker run -d -v ${PWD}:/usr/share/nginx/html \
    --name vanilla-nginx -p 8080:80 nginx:1.19
```

This can be used to share files or directories with a container,
allow them to store things persistently, or give more complex
configurations to a container using config files instead of a
countless environment variables.

# Define a named volume

Use a named or an anonymous volume if you don't want to mount an
existing local directory but have a space that can be shared by
containers or reused by containers started sequentially, e.g. a DB
requiring an restarts.

Download the file `index.html` from the course resources folder
into your current directory.

Create a named volume managed by Docker.

```sh
docker volume create html
```

Start a vanilla nginx using the volume.

```sh
docker run -d -v html:/usr/share/nginx/html \
    --name vanilla-nginx -p 8080:80 nginx:1.19
```

If you access http://localhost:8080 now, you'll see the default nginx
welcomepage.

Copy the local index file to the /usr/share/nginx/html/ folder in the
container where the volume is mapped.

```sh
docker cp ./index.html vanilla-nginx:/usr/share/nginx/html/
```

> Hint!
>
> `docker cp` copies a local file or directory into a container

Access the file through your browser http://localhost:8080

Start a second nginx on a different port using the same volume and
access the file on that one. The same file will be served since both
containers access the same volume.

```sh
docker run -d -v html:/usr/share/nginx/html \
    --name vanilla-nginx2 -p 8081:80 nginx:1.19
```

You can now remove both containers and start new ones which will
have access to the same content as long as you don't delete the volume.

# Inspect a running container

In order to get more insight into a running container, we can start
a shell inside it and connect interactively.

Start a new container from your node application with the `-d` option.

```sh
docker run -p 8080:8080 -d --name my_node_container awesome-node
```

Start a shell inside your container and connect to it interactively.

```sh
docker exec -it my_node_container /bin/bash
```

Notice that you can now access the file system from the view of
the container. You can also see the isolation in play using e.g.
`ps -ef` and have only the processes show up that are running
inside the container.

You can also start a node REPL and execute JavaScript code.

You may notice that npm is also present, which is usually not
required on a system that just runs the application and can be
considered a security risk (have no tooling installed that is
not needed), this can be mitigated using multi-stage builds
that use different, but compatible, images for build and run,
with only the build image having all the build tooling installed.

Docker exec starts a process in an already running container.
Adding the `-it` options allows us to connect to that process
interactively. The binary must be present inside the container.
This is why /bin/bash does not always work since sometimes another
shell is available. When it doesn't try /bin/sh. There are also
containers that do not have a shell installed at all.

# Start a container with a different command than it's default

Like the docker exec command, the following is very useful when
building images.
Containers have a default process that is started, but this can
be overridden:.
The following command starts your awesome node image with just
node running in REPL mode, without starting your application,
and connects to it interactively.

```sh
docker run -e HELLO=WORLD -it awesome-node node
```

Execute a node command such as `process.env.HELLO` or
`process.version`.

If you're building a container and your start command doesn't
work properly you can also force start a shell instead.

```sh
docker run -it awesome-node /bin/bash
```

Depending on the container image, the entrypoint may have to
be overridden. We can, for example, set it to the cat command
and list a file, as the CLI arguments passed to the docker run command
after the image-name will all be passed to the entrypoint, the following
command will pass `server.js` to `/bin/cat` and cat will output that file
to the terminal.

```sh
docker run --entrypoint /bin/cat -it awesome-node server.js
```

# Docker networking

Our containers so far have been totally isolated. We can use networks
to allow them to interconnect.

Create network named "dbnet".

```sh
docker network create dbnet
```

Start a container with PostgreSQL and assign it to the network.

```sh
docker run --network dbnet --name mypostgresdb --restart always \
    -e POSTGRES_PASSWORD=example -d postgres:13.1
```

Start Adminer (a very simple SQL web frontend) and assign it to the same
network.

```sh
docker run -p 8080:8080 -d --network dbnet adminer:4.7
```

Access adminer on http://localhost:8080 and have it connect to your
PostgreSQL database using `mypostgresdb` as the server name, `postgres`
as the username and `example` as the password.

Within a network, a container's name is used as it's hostname.

Before moving on to the next exercise, tear down the containers using
`docker stop` and `docker rm` or `docker rm -f`.
Tear down the network using `docker network rm dbnet`.

# Docker compose

If you're often running the same containers, you can put that
configuration into a docker-compose file to save some typing.

The provided docker-compose file has the configuration for the PostgreSQL
database, the Adminer and a network.

Start the config using `docker-compose up -d` from within the same directory.
You can see the running containers and network using `docker ps` and
`docker network ls`

You can stop and start them using `docker-compose stop` `docker-compose start`
or `docker-compose restart`

The command `docker-compose down` will remove all resources such as networks
and volumes as well.

Inspect the `docker-compose.yml` file to see it contains the same information
that we have previously given via CLI.
