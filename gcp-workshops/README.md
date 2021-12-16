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

## Part 3

We recommend starting with a new / empty project for this part, but with some adjustments, it will be possible to use the project from part 2 as well.

### Terraform

- Download and i nstall Terraform for your platform from the [Downloads page](https://www.terraform.io/downloads.html).
  Alternatively, you may use it in GCP web shell, where it's already installed.

Clone this git repository and check it out at the tag `gcp-sql-terraform`.

- Clone this repository and then checkout at the tag `gcp-sql-terraform`:

  ```sh
  git checkout gcp-sql-terraform
  ```

- Switch to the folder `mysql-terraform` and investigate the `main.tf` file.

  ```sh
  cd mysql-terraform
  ```

  The `main.tf` file contains Terraform configuration for a MySQL instance in Cloud SQL that is exposed only through an internal IP, which is exposed on the default VPC network of your project.
  It does not create a database or database user (database user creation would be possible through Terraform).

- Enter your GCP project's id in the provider section of the `main.tf` module.

- Make sure the following three APIS are enabled for your project.

  - [Cloud SQL API Overview](https://console.cloud.google.com/apis/library/sql-component.googleapis.com)
  - [Compute Engine API](https://console.cloud.google.com/apis/library/compute.googleapis.com)
  - [Service Networking API](https://console.cloud.google.com/apis/api/servicenetworking.googleapis.com/)

- In the CLI, initialize Terraform to setup the required providers:

  ```sh
  terraform init
  ```

- Now apply the terraform configuration to create the MySQL instance

  ```sh
  terraform apply
  ```

  It will show you which objects will be created and asks for confirmation.

  Creation of the MySQL server will take about 10 minutes.
  Meanwhile, you may start working on the GKE setup.

- Once the server has been created, create a database `tabsorspaces` and a database user through the web console or the CLI.
  Make sure you note user and password.

### Google Kubernetes Engine

In this part we will deploy a GKE cluster, then deploy a simple web app to the cluster and expose it on an HTTP ingress load balancer.
In the second part we will deploy the node-mysql-example app from part 2 to GKE as well, ensure it has access to secrets via Workload Identity and connect it to the database.

- Make sure the GKE API is enabled: [GKE API Overview](https://console.cloud.google.com/apis/library/container.googleapis.com).

- Deploy a new GKE cluster via the web console.
  Make sure you chose an Autopilot cluster and make it a private cluster, with access to the control plane through its external IP enabled and the region set to europe-west6.

- Connect to the cluster using kubectl from your local machine or the web shell:

  ```sh
  gcloud container clusters get-credentials <cluster-name> --region europe-west6 --project <project-name>
  ```

  This updates your local kubeconfig file with the configuration for the respective cluster.

- Create a new namespace `gcp-ws-day3` and set it as default:

  ```sh
  kubectl create ns gcp-ws-day3

  kubectl config set-context --current --namespace=gcp-ws-day3
  ```

#### Awesome Node App

- Now checkout this repository at the tag `gcp-gke-awesome-node`:

  ```sh
  git checkout gcp-gke-awesome-node
  ```

- Deploy the awesome-node application using the configuration provided in `awesome-node-k8s.yaml`:

  ```sh
  kubectl apply -f awesome-node-k8s.yml
  ```

- The deployment shouldn't take too long.
  You can watch it using the following commands:

  ```sh
  watch "kubectl get deploy"
  watch "kubectl get pods"
  watch "kubectl get ingress"
  ```

  The ingress will most likely take the longest.
  It creates an HTTPS load balancer with an external IP.
  Once it's ready the command below should also show the IP address of the ingress:

  ```sh
  kubectl get ingress
  ```

- Make sure to have a look at the GCP web console, and which information is available about your workloads, services, ingresses etc. on there as well.

- Access the application via an HTTP call to the ingress controller.
  It should return a simple JSON response with a hello-world message.

#### Tabs VS Spaces App

The Tabs VS Spaces app accesses a database.
Since our GKE cluster is in the default VPC and the database is exposed to this VPC on a private IP, we will not have to do additional networking configuration.

However, to access the database our application is required to use the right credentials and a GCP service account with the permissions to access Cloud SQL.
To achieve this, we use Workload Identity, which allows assigning Kubernetes service accounts to be mapped to a GCP service account.
Additionally, we use secret manager again, to store the credentials and configuration for the database.

- Make sure the secret manager API is enabled: [Secret Manager API Overview](https://console.cloud.google.com/apis/library/secretmanager.googleapis.com)

- Create the 4 secrets that are required by the Tabs VS Spaces app to access the db:

  ```sh
  echo -n "<db-ip>" | gcloud secrets create db_host --replication-policy=automatic --data-file=-
  echo -n "<db-name>" | gcloud secrets create db_name --replication-policy=automatic --data-file=-
  echo -n "<db-user>" | gcloud secrets create db_user --replication-policy=automatic --data-file=-
  echo -n "<db-password>" | gcloud secrets create db_password --replication-policy=automatic --data-file=-
  ```

- Now create a GCP service account named `gke-cloudsql-example` via the IAM panel in the GCP web console.
  Give it the `Cloud SQL Client` and the `Secret Manager Secret Accessor` permissions.

- Create the policy-binding tying the Kubernetes service account `tabsorspaces-sa` in the namespace `gcp-ws-day3` to the newly created `gke-cloudsql-example` GCP service account:

  ```sh
  gcloud iam service-accounts add-iam-policy-binding gke-cloudsql-example@<project-id>.iam.gserviceaccount.com \
  --role roles/iam.workloadIdentityUser \
  --member "serviceAccount:<project-id>.svc.id.goog[gcp-ws-day3/tabsorspaces-sa]"
  ```

- Now checkout this repository at the tag `gcp-gke-cloud-sql`:

  ```sh
  git checkout gcp-gke-cloud-sql
  ```

- In the file `cloud-sql-example-k8s.yaml` configure the service account annotation at the top to include the correct project id.
  Alternatively, remove the annotation alltogether and execute the following command _after_ you have applied the k8s-configuration.

  ```sh
  kubectl annotate serviceaccount tabsorspaces-sa \
    --namespace gcp-ws-day3 \
    iam.gke.io/gcp-service-account=gke-cloudsql-example@<project-id>.iam.gserviceaccount.com
  ```

- Also set the GCP project number (not the id) in the environment variable of the pod specifications.

- Deploy the Tabs VS Spaces app:

  ```sh
  kubectl apply -f cloud-sql-example-k8s.yml
  ```

- Reminder: If you removed the annotations on the service account, you will have to add it now:
  ```sh
  kubectl annotate serviceaccount tabsorspaces-sa \
    --namespace gcp-ws-day3 \
    iam.gke.io/gcp-service-account=gke-cloudsql-example@<project-id>.iam.gserviceaccount.com
  ```

### Cloud Functions

We'll deploy a small Cloud Function, that is available via HTTP and outputs a short message about what the current count in the Tabs VS Spaces Poll is.

Since Cloud Functions are not deployed into our VPC, we will have to enable the Serverless VPC access connector.

- Follow the instructions at [Creating the Serverless VPC Access Connector](#creating-the-serverless-vpc-access-connector).
  You may give the Connector a different name.

- Enable the Cloud Function API: [Cloud Functions API Overview](https://console.cloud.google.com/apis/library/cloudfunctions.googleapis.com)

- Checkout this repository at the tag `gcp-cloud-function`:

  ```sh
  git checkout gcp-cloud-function
  ```

- Create a function via the Web Console and in the first screen make the following configurations:

  Select the region "europe-west6", set the Trigger to HTTP(S), allow unauthenticated invocations, and make sure it uses the default service account.
  Also make sure, to set the environment variable `GCP_PROJECT_NUMBER` to your GCP project _number_.

  Make sure to enable the VPC access connector created before in the `Connections` tab of the "Runtime, build, connections and security settings" section and select `Route only requests to private IPs through the VPC connector`.

- In the second screen you're asked to input the code.
  You may copy and paste the code from the three files in the `node-mysql-function` or zip the whole folder and upload it on the UI.

- Make sure you inspect the code, and notice that it does not contain any more code related to path handling via express (although we could still do that in a function if we desire).

- Hit the deploy button, to start building and deployment of the function.

- Also make sure, that in IAM, the service account for app engine has the permissions `Cloud SQL Client` and `Secret Manager Secret Accessor`.

- Once it's deployed, go to the function and select the Permissions tab.
  On the permissions tab, click "Add" and in the overlay select the principal "allUsers" and give it the role `Cloud Functions Invoker`.

- Now go to the "Triggers" tab.
  The triggers tab should display the link to the function.
  Click it to see the current state of the Tabs VS Spaces poll.

### Cloud Build

In this section, we will use Cloud Build to automatically build a container image, whenever a push on a certain GitHub repository happens and deploy it to our GKE cluster.

Prerequisites:

- Have a GKE Cluster ready for deployments, such as the one created in the chapter [Google Kubernetes Engine](#google-kubernetes-engine).

Instructions:

- Fork the Awesome Node Repository on GitHub to your personal account [https://github.com/bespinian/awesome-node](https://github.com/bespinian/awesome-node)

- Enable the Artifact Registry API: [Artifact Registry API Overview](https://console.cloud.google.com/apis/library/artifactregistry.googleapis.com)

- Create an Artifact Repository in the Web Console

- Enable the Cloud Build API: [Cloud Build API Overview](https://console.cloud.google.com/apis/library/cloudbuild.googleapis.com)

- Connect Cloud Build to your GitHub Account and the Repository

  - Head to Cloud Build
  - Go to "Triggers"
  - Click "Connect Repository" at the top and follow the process

- In Cloud Build, go to Settings and enable the "Kubernetes Engine Developer" role for the Cloud Build service account

- Create a new Trigger

  - Select your newly created GitHub repository
  - In Configuration, choose the type "Cloud Build configuration file"
  - Click create

- Configure the cloudbuild.yaml in your forked repo

  - Set the project id, artifact repository name and cluster name where required

- Push the configured cloudbuild.yaml to your fork
  - Check in the history on Cloud Build, that the build has been automatically triggered and is running
  - Have a look at the logs
  - Once you see in the logs, that step 2 has passed, see that the image has been created in the Artifact Registry on the web console
  - Wait for the build to finish and the ingress to complete and try to access the app via the ingress

### Cloud Monitoring

Cloud Monitoring deals with metrics, traces, dashboards and alerts.
We will use it in this Hands-On Session, to inspect certain metrics, create custom metrics from logs, add alerts, and see how we can create a widget on a dashboard.

#### View Metrics in Cloud Monitoring and Create a Dashboard Chart

Gain some familiarity with the Metrics Explorer and charts.

- Go to the Metrics Explorer in Cloud Monitoring
- Create a chart to display CPU request utilization of your containers from the auto-awesome-node application deployed to GKE.
  - Find the CPU Request utilization metric, from the Resource Type "Kubernetes Container"
  - Add a filter, to select only the metrics from containers in the "auto-awesome-node" app namespace.
    Alternatively, you could also filter by `container_name`, if you only want the metrics from our application container, but in many cases that may yield results from other namespaces as well.
  - Make yourself familiar with the Aggregator, grouping and alignment period options.
  - Finally, use the save chart button in the top, to create a new dashboard and save the chart to it.
- Visit your dashboard and make sure your chart is visible.

#### Create a Log-Based Metric

In this section we create a custom metric based on logs.
Specifically, we want to know the distribution times with which the `/slow-request` endpoint of our awesome-node application is being called.
The `/slow-request` endpoint can be called with a query parameter, specifying a timeout.
The endpoint will wait said time (in seconds), before returning.
Our metric shall, for each request, contain that parameter.

- Head over to the Log Explorer in the Cloud Monitoring menu
- First, add a filter to show only requests from the auto-awesome-app.
  This can be achieved, by filtering based on the `labels.k8s-pod/app` property, for example.
- Additionally, filter by `requestPath`, which is emitted in the `jsonPayload` properties of the log events.
- Finally, to ensure, we get only one entry per request, even when one request emits more than one log event, filter by type.
- The final query string could look like this:
  ```txt
  labels."k8s-pod/app"="auto-awesome-node" AND jsonPayload.requestPath="/slow-request" AND jsonPayload.type="postSlowRequest"
  ```
- Locate the "Create Metric"-Button and click it
- Select a Distribution Type Metric, give it a name and specify the unit to be `seconds`
- In the log explorer, look at the event, to see from which field the time waited could be extracted with a regular expression
- At the bottom, specify the field to be extracted to be `jsonPayload.message`
- The following regex, will extract the time waited from that field: `(\d+.\d|\.\d+|\d+)`
- Make a few dozen requests to the slow-request endpoint with different times
  ```sh
  curl http://<your-ingress-ip>/slow-request?request_time=.2
  curl http://<your-ingress-ip>/slow-request?request_time=2
  curl http://<your-ingress-ip>/slow-request?request_time=.1
  ```
- look for your new metric in the metric explorer and visualize it using a heatmap
  Hint: reduce the visualization time to the last 2-3 minutes, in which you made the requests.

#### Alerting

We'll create an alert, which notifies us, when our application responds more than 5 times wiht HTTP status 404 within a minute.
The Load Balancer, which is automatically created for our ingress, automatically emits metrics about HTTP requests to Cloud Monitoring.

To achieve this

- Go to Alerting in the Cloud Monitoring Overview
- Click "Create Policy"
- Select the "request count" metric from the load balancer metrics
- Filter by forwarding rule, to select only the requests intended for our apps
- Add an additional filter, to select only the requests with response code 404
- Select a rolling window of 1min and the count function
- Sum all regions together by selecting sum in the "Across Time Series" section
- Move to the next screen
- Configure a threshold, at 5 occurrences
- Move to the next screen
- In the "Notification Channels" Dropdown, click "Manage Notification Channels"
- Add an "Email" notification channel for your email address
- Back on the Alerting Policy Creation screen, select that newly created channel
- Save your alert
- Access the auto-awesome-node application and provoke some `404 Not Found` responses by requesting a non-existing endpoint such as /404
- It will take a while, so keep generating some 404s every few seconds for a minute or two
- Finally, your alert should start firing.
  This should be visible in the Alerting overview, and you should also receive an email.

#### Optional: Create a GKE Standard Cluster to Check out Workload Metrics

Workload Metrics is not yet generally available and not available as a beta feature on Autopilot. You can create a GKE Standard Cluster and deploy the awesome-node app to check it out.

Finally, you will need a PodMonitor custom resource to specify details for the endpoint.
Find documentation for the PodMonitor [here](https://cloud.google.com/stackdriver/docs/solutions/gke/managing-metrics#configure-workload-metrics)

### IaaS & Networking

To gain some slight familiarity with how easy virtual machines can be created and basic network management tasks, we will create 2 VMs in this section, which lie in different VPC networks and connect the VPC networks via peering, so pinging (or otherwise accessing) each other is possible.

- Creating the first Linux VM
  - Go to "Compute Engine", select "VM instances" and click "Create Instance"
  - Select the e2-micro size, the region west-europe6 and choose a zone
  - Leave all other settings default
  - it will create a Debian instance (visible in the "Boot Disk" section) in your default VPC and the subnet for the specified region and expose it to the internet through a public IP
- Connect to it using ssh from your console
  ```sh
  gcloud compute ssh --zone "<region>" "<instance-name>" --project "<project-name>"
  ```
- Create an additional VPC
  - Choose a name, such as "custom-vpc"
  - Click "custom subnet creation"
  - Give the subnet a name, such as "custom-europe-west6"
  - Choose europe-west6 as the region and set the IP range to 10.200.0.0/24
    This IP range, does not conflict with the IP ranges, that are automatically created for a default VPC.
  - Create a firewall rule that allows ICMP ingress from all internal addresses by setting the protocol to "icmp" and the source filter to 10.0.0.0/8
- Create a second VM in your new VPC and is not accessible from the internet
  - Choose e2-micro and west-europe6 again
  - In the advanced section expand the "Networking" section and select the default network interface
  - Select your newly created VPC and set "External IP" to "None"
  - Click create
  - You'll notice that it won't receive an external IP
  - Try to ping it from the first VM and notice it's not possible
- Make a network peering between your custom VPC and the default VPC
  - Go to VPC network in the Cloud Console and select VPC Network Peering
  - Click "Create Peering Connection"
  - Give it the name "default-custom-peering" and select the default VPC
  - For the "Peered VPC Network" select your project and select the name of your VPC below
  - Click Create
  - Add a second peering, but select the custom network first, and the default network second
- Ping your second VM again from the first one and notice, that it should now work.
