# Bespinian GCP Workshop - Instructions

These instructions provide rough guidance through deploying the sample application located in the `gcp-workshops/spring-boot-example` to GCP's App Engine Service.

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

Move to the folder `gcp-workshops/spring-boot-example` within the repo.

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

## Cloud SQL - Part 1

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

### Notes on Securely Connecting to a Database

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

## Cloud SQL - Part 2

In this part we will securely connect to our database.
This involves

- using a private IP for the database and deleting the public IP
- enabling an App Engine application to access a VPC
- use secret manager to store credentials to our database

We're starting from scratch, so you can start with a plain project.

### Creating a VPC

First we create a VPC.
Chose the "Networking -> VPC network" option on the left hand menu.
Click "Create VPC Network" at the top.
Choose a name, select "Automatic" in the "Subnet creation mode" section and leave all other settings as default.

Alternatively, use the following command:

```sh
gcloud compute networks create <NETWORK-NAME> \
    --subnet-mode=auto \
    --bgp-routing-mode=regional \
    --mtu=1460
```

[More information on VPC creation](https://cloud.google.com/vpc/docs/using-vpc#creating_networks)

### Creating the MySQL Instance

Create a new MySQL instance in Cloud SQL.
Make sure it has the following settings, some of which are only available when expanding the "Configuration options":

- Database Version: MySQL 5.7
- Region: europe-west6
- Machine Type: Shared Core (saves your free credits)
- In the "Connections" section disable the "Public IP", enable "Private IP" and select your newly created VPC.

Create your database instance.
Once this has completed do the following tasks:

- Create a db user and password and note both for later use
- Create a database called `tabsorspaces`

### Creating the Serverless VPC Access Connector

The VPC Access Connector allows the App Engine app to access resources exposed in our VPC, such as the newly created Cloud SQL instance with its private IP.

To create the Serverless VPC Access Connector

- Go to the "VPC Network" menu and select "Serverless VPC Access"
- Click "Create Connector"
- Give it the name `app-engine-to-mysql`
- Select the `europe-west6` region
- Select the VPC you've created before and select custom range with the subnet 10.8.0.0/28, which should be available if you've used the default regional subnets.

To find more information, visit: [Configuring Serverless VPC Access](https://cloud.google.com/vpc/docs/configure-serverless-vpc-access#creating_a_connector)

### Deploying the Application

In this example we deploy a very small Node.js application.

- Clone this repository and then checkout the tag `gcp-cloud-sql-vpc`:

  ```sh
  git checkout gcp-cloud-sql-vpc
  ```

- You'll find the `node-mysql-example` folder with the application code.
  Change to the directory:

  ```sh
  cd node-mysql-example
  ```

- Within this directory, you'll find the `app.standard.yaml` file.
  Adjust that file to set the environment variables for the database name, user name and password as well as the private IP and port of your database instance.

  Additionally, set the correct project ID

- Deploy the application by running:

  ```sh
  gcloud app deploy app.standard.yaml
  ```

- After the app has been deployed, try to access it and see if you can cast a vote.
  If it works and the votes get updated, the connection was successful.

> Note
>
> We have now established a secure connection to our server and locked it down to anybody accessing it from the internet.
> Even if a vulnerability in the server is discovered, the risk that it may be exploited on our server is reduced.
>
> Compare this to the solution from part 1, where we exposed the instance to the whole internet or had to manage specific IP ranges to secure it somewhat.

#### Extra Task

We cannot connect to the database for development purposes or to inspect the contents of the database for debugging.

Try to set up a Public IP, but instead of adding network ranges, use the Cloud SQL Proxy to connect to the instance from your local machine.

The Cloud SQL Proxy acts as a proxy towards your Cloud SQL instance with a Public IP and requires GCP accounts to setup the connection.
Your local application or SQL management tool can then access the database on localhost using the SQL native credentials.

Use the following commands to set it up and learn more at the [docs](https://https://cloud.google.com/sql/docs/mysql/connect-admin-proxy).

```sh
gcloud components install cloud_sql_proxy
cloud_sql_proxy -instances=<instance-name>=tcp:0.0.0.0:3306
```

Now you can run the application locally and connect to the same database without exposing it to login attempts from attackers.

### Store the DB Credentials in Secret Manager

In this task we will remove any confidential config from our direct deployment and put them in secret manager instead.

- First, enable the Secret Manager API.
- Create 4 secrets
  | Secret Name | Secret Value |
  | - | - |
  | db_host | \<your dbs private IP and port 3306\> |
  | db_name | \<your db name, e.g. tabsorspaces\> |
  | db_user | \<your db user\> |
  | db_password | \<the password you set\> |
  A secret may easily be created through the shell:
  ```sh
  echo -n "<secret value>" | gcloud secrets create <secret name> --replication-policy=automatic --data-file=-
  ```
- Enable the service account of your app engine app to access the secrets.

  Evaluate the service account of your app using:

  ```sh
  gcloud app describe
  ```

  Within "IAM & Admin -> IAM" give it the role "Secret Manager Secret Accessor" on the whole project, or instead, head to secret manager and give it access to each secret individually.

- Checkout the repository at the tag `gcp-cloud-sql-secret-manager`.
  You may have to discard changes.
  Especially those made to the `app.standard.yaml`.
  ```sh
  git checkout gcp-cloud-sql-secret-manager
  ```
- In the `app.standard.yaml` set your project number.
  This is used to access your secrets.
  
  Also make sure, that the value for the VPC access connector is correct again.
- Deploy the app using the following command:
  ```sh
  gcloud app deploy app.standard.yaml
  ```
