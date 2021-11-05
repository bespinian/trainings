# Bespinian GCP Workshop - Instructions

These instructions provide rough guidance through deploying the sample application located in the `spring-boot-example` to GCP's App Engine Service.

## Tools

You may work with the Cloud Shell from GCP, but it is recommended to also install the gcloud CLI.
The Cloud Shell is available through the [GCP Web Console](https://console.cloud.google.com/).

### The gcloud CLI and the Cloud SDK

The gcloud CLI is part of Google's Cloud SDK.
Follow the installation instructions for the Cloud SDK on your platform [here](https://cloud.google.com/sdk/docs/install).
Make sure to install the extension for app engine java.

## Deploying the Basic Hello World Spring Boot App

This part will have basic instructions about deploying the sample app in it's simplest form to App Engine.
Check out the repository at the tag `gcp-app-engine-basic`.

```sh
git clone -b gcp-app-engine-basic git@github.com:bespinian/bespinian-gcp-workshop.git
# or
git clone -b gcp-app-engine-basic https://github.com/bespinian/bespinian-gcp-workshop.git
```

Move to the folder `spring-boot-example` within the repo.

Create an App Engine through the Web Console or the CLI.
I recommend deploying to the region `europe-west6` which is located in Zürich.

```sh
gcloud app create
```

Now use the `gcloud` CLI to deploy the app.
Ensure that the correct project is selected.
You can usually leave the default settings.

```sh
gcloud app deploy
```

GCP will take a few minutes for the deployment.
Once it's there you can browse it at the given location.
Append `/greeting?name=Pikachu` to access the right endpoint.

Make a few requests and you should notice that there are two or more counters, separately increasing the id in your response.
This is because of App Engine's automatic scaling.

Make yourself familiar with the App Engine on the Web Console.

Try to find out what Apps, Services, and Versions are, and where to find the logs.

And try to find, after a little bit of inactivity, that App Engine scales to zero, if you set the profile to `Standard` and not `Flexible`. [More info!](https://cloud.google.com/appengine/docs/the-appengine-environments)

<details>
<summary>Apps, Services, and Versions</summary>
Within a project you can have only one app.
Everything deployed within, should therefore belong together.

However, you can have multiple services, which are different apps.
You may for example host a few microservices, that belong to the same domain but are independent on different services within the same app.

Per service, you may have multiple versions.
Each time you deploy, a new version is created.
Versions allow you to do quick rollbacks, test releases, or gradual traffic migration.

The relationship is further described in [An Overview of App Engine](https://cloud.google.com/appengine/docs/standard/java11/an-overview-of-app-engine)

</details>

## Logs

Our application logs a lot of information on boot and something everytime our GreetingController is called.
These messages go to stdout and stderr.
App Engine automatically collects them and forwards them to the Cloud Operations Log Explorer.

Open The Cloud Operations Log Explorer and investigate the logs which are available from our application.

You can also use the CLI with the following command:

```sh
gcloud app logs tail
```

Make some requests to your app to ensure you see some logs.

You should notice, that App Engine also adds HTTP request logs and notice, that they are displayed differently and offer more powerful filtering options.

It is hard to filter by count id between 3 and 7 for example or show all logs with the `name=Pikachu`.
The [logging query language docs](https://cloud.google.com/logging/docs/view/logging-query-language) give some insight how it might still be achieved, e.g. through Regex, but there are better options.

Adjust the app, so that instead it logs JSON messages in the GreetingController.
Replace the line with the `logTemplate` variable with the following one:

```java
String logTemplate = "{\"endpoint\": \"/greeting\", \"name\": \"%s\", \"count\": %d}";
```

You may also use the version in the repository at the tag `gcp-app-engine-structured-logging`.

```sh
git checkout gcp-app-engine-structured-logging
```

Redeploy the app, make a few requests and find out how you can now properly filter count ID between 3 and 7 or by the name given in the request.

Instead of formatting JSON ourselves, follow the recommended options, by using the Google [Logback appender for Cloud Logging](https://cloud.google.com/logging/docs/setup/java).

## Monitoring

Also take a look at the metrics that are out of the box collected in the Operations Monitoring tools.

We will have a look at this later on.

## Cloud SQL

Our apps should not manage state themselves, and instead store data in managed backing stores.
GCP has various offerings.
We use Cloud SQL, which has a MySQL compatible API to store and read data in the example app.

Checkout the app at the tag `gcp-app-engine-cloudsql`.

```sh
git checkout gcp-app-engine-cloudsql
```

If you're familiar with Java, you'll notice that it wants to connect to a MySQL DB using the standard JDBC/MySQL driver.

Before you deploy, set up a Cloud SQL instance.
I recommend using the Web Console to start.

When you create the database, ensure you choose the MySQL compatible one and ensure you select the shared tier instead of the default database size.
Creation of the database may take up to about 15 minutes.

After the database is created, use the Web Console, to create a database and note it's name.

Also create a user and note down your username and password.

Additionally, we expose the database on the internet, by adding the network range `0.0.0.0/0` to the allowed networks in the connections tab.

> WARNING!
>
> Never open the range `0.0.0.0/0` unless for explicit short-term testing purposes far away from any data.
>
> The range `0.0.0.0/0` is all of the internet.
> Your database is therefore accessible to anyone for login attempts.
>
> We'll investigate better ways to connect to your database later.

Once your database is deployed, configure your database connection in the file `src/main/appengine/app.yaml`.
You'll need to set the IP, the database name, user name and password.

Then deploy the app once again.

### Securely connecting to a database

Google offers better ways to connect to your Cloud SQL database.

We can still connect to the public IP, but use the service account and Google's SocketFactory to set up connections: https://cloud.google.com/sql/docs/mysql/connect-app-engine-standard#public-ip-default

Additionally, we may even go through a VPC, which allows us to take our database off the internet completely.

> What's a VPC (Virtual Private Cloud)?
>
> VPC's are a software based network within the Google Cloud where you traditionally deploy virtual machines.
>
> VPC's allow us to use IP based firewalls.
>
> Many services can be exposed within your VPC.
> This means they'll be available through an internal IP address (usually starting with `10.x.x.x`) from within your VPC.
>
> App Engine can access these services through a Serverless VPC Access connector if you enable it.
>
> VPC's also allow private interconnection with on-premise datacenters through VPN's or Cloud Interconnect.
>
> VPC's are an essential concept used in many services in GCP.

If you're done with deploying and connecting the app through the public IP, try setting up the connection through the VPC.
Start by looking around the VPC tab in the Web Console.
Then add a private IP to your Cloud SQL instance and follow the description at https://cloud.google.com/sql/docs/mysql/connect-app-engine-standard#public-ip-default to change the application to use it.
