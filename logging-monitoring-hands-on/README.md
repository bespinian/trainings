# Logging & Monitoring Hands-On

## Accessing the Systems

Links and credentials to access Kibana, Grafana and Prometheus will be handed out along the training.

## Prerequisites

- Have kubectl installed and access to the cluster
- Set `awesome-node` as the default namespace for kubectl\
  `kubectl config set-context --current --namespace=awesome-node`

## Hands-On Lab

### Scenario Introduction

The Awesome Node application should be setup in the `awesome-node` namespace of your Kubernetes cluster.

It is based on NodeJS, runs with three replicas, serves a REST API and emits logs and exposes some metrics for monitoring application internals.

The application also has some issues. Your task is to find out as much about the issues with the application without looking at it, and improving the monitoring system.

> Important!
>
> Do not modify the awesome node deployment. Instead, try gathering information just by inspecting the system through the information provided by Kubernetes and the application through metrics and logs. Inspect the source code of the application at the end of the lab to

As the operator of the application, you notice that the pods have alot of restarts and decide to investigate further.

```bash
$ kubectl get pods
NAME                                              READY   STATUS    RESTARTS   AGE
awesome-node-558f58cd47-dltn6                     1/1     Running   89         2d21h
awesome-node-558f58cd47-gcpvq                     1/1     Running   89         2d21h
awesome-node-558f58cd47-hq5kc                     1/1     Running   90         2d21h
.
.
.
```

### Kubernetes Native Tooling

You should be able to find some information about why containers are restarting using `kubectl` commands.

#### Hints

Try to find out as much as possible on your own and then compare with the notes in the dropdown.

<details>
  <summary>What you should find out</summary>
  
  ##### Probes failing
  Running `kubectl describe pod { pod_name }` should display in the events, that readiness and liveness probes failed. Liveness probe failure prompts Kubernetes to restart pods.

You'll also see that in this case the probe failed usually with a client timeout or connection reset by peer potentially giving you hints about the state of the TCP socket.

Describe also shows how the probes are defined. You'll see both probes accessing the same HTTP endpoint.

##### OOMKilled

When you use `kubectl describe`, the container section of the pod also shows a `State` and a `Last State` section. The last state section should tell you when the last restart happened and that the reason was `OOMKilled` (out of memory killed).

##### Events

If you check events using `kubectl get events` you will get the same info about probes failing as with the `kubectl describe` command.

##### Kubectl Logs

The `kubectl logs { pod_name }` command can often give you valuable insight when issues are caused by internal problems of the application. In this case you'll mostly find log lines from the health check endpoint. The output is also hard to scan for valuable information.

##### What's Missing?

We can not find any stack trace or other exception message in the logs. This is also due to the fact that the operating system immediately kills an application when it allocates too much memory (or tries to), and does not tell it that it's too much or that it's about to be killed.

We also just got information about the most recent restart of each pod and may assume the other restarts happened for the same reason, but cannot be certain.

</details>

### Aggregated Logs

Elasticsearch and Kibana are installed and offer you a more convenient way to search through log messages.

FluentD is an agent on each Kubernetes node, that collects logs from all containers and feeds them into Elasticsearch. It enriches logs with metadata, such as from which pod, container and namespace it originates. This allows filtering / aggregating by those values.

Access Kibana and on the "Discovery" Panel, search through the logs of the application.
The query language is simple and Kibana shows the available fields by which you can query.
Kibana also offers autocomplete to simplify creating queries.

#### Examples

- You can filter on the actual `log` message with the query `log: /healthcheck`
- Filter by pods with `awesome` in their name but excluding the ones from the `awesome-gitops` namespace: `kubernetes.pod_name: awesome-node AND NOT kubernetes.namespace_name: gitops`

#### Task

Try to achieve the following:

- Show only logs from the pods tagged `awesome-node` or from the namespace `awesome-node`
- Filter out low-information messages such as the healtch check messages.
- Find out when containers have been restarted in the last 2 hours (in which minute).

<details>
  <summary>What you should find out</summary>
  
  In Kibana, there's only hints to restarts from the server startup message `Example app listening on port 8080`. This gives us an indication about when restarts happened over an arbitrary time-point.
  An observer might notice, that in some cases the last message logged was of type `preHealthCheckWithAllocation` which is usually followed by a `postHealthCheckWithAllocation` log message, indicating where the issue may be in the code.

If you filter out those health check log messages, you should find the more relevant messages much more easily.

</details>

### Metrics

A simple Grafana Starter dashboard showing CPU and memory consumption of the pods already exists.
Go check out the dashboard and see if you get any more info from this about the failure of the application.

Prometheus is setup to scrape data from Kubernetes nodes using the node exporter, from the Kubernetes API using the Kube-State-Metrics exporter and from pods with a `/metrics` endpoint.

To find out more about the exposed metrics check the docs:

- Node-Exporter: https://github.com/prometheus/node_exporter
- Kube-State-Metrics: https://github.com/kubernetes/kube-state-metrics/tree/master/docs#exposed-metrics
- Awesome-Node App uses the `express-prom-bundle`: https://github.com/jochen-schweizer/express-prom-bundle

Access the Prometheus web interface and, using the docs and autocomplete, check whether you can find additional metrics related to the application.

Make sure to use the [PromQL documentation](https://prometheus.io/docs/prometheus/latest/querying/basics/).

<details>
  <summary>What you should find out</summary>
  
  The sawtooth-shaped curve on the memory chart should indicate rather clearly, that there's a memory leak in the application, with memory constantly rising until the process is killed and restarted.

Using Prometheus, you may find the `kube_pod_container_status_restarts_total` metric, which tells you about restarts.
Using `kube_pod_container_status_restarts_total{namespace="awesome-node"}` you may restrict to showing only restarts from the `awesome-node` namespace.

</details>

#### Extend the Dashboard

In order to catch more issues earlier, create additional Grafana charts.

- Make a panel showing pods with recent container restarts. Hint: Use the `Stat` type Grafana panel and try to get it to display pod name and restart count over the last hours.
- Graph the request rate per second of the awesome node application over the last few hours. Hint: This requires aggregating metrics and using the
- Create a chart that shows request rates per bucket. Take a look at the `http_request_duration_seconds_bucket` and `http_request_duration_seconds_count` metrics and think about how to best display the number of requests "between" buckets.

When creating panels, it's helpful to first use the Prometheus web interface first to create appropriate queries.

##### A Word on Counters

Many metrics are counters that continuously increase and therefore contain a history of the metric. These metrics are often only valuable if compared / observed over time. Grafana automatically pulls the values over a specific time period and shows you increases. But in many cases, it is more valuable to break the counters down and see how they change within specific time increments.

The `rate()` function of Prometheus cleanly calculates per second average rate between datapoints, taking into account how much time has passed between them and also accounting for counter resets, that happen when a container restarts.

The [\<aggregation\>\_over_time()](https://prometheus.io/docs/prometheus/latest/querying/functions/#aggregation_over_time) functions offer additional ways to highlight valuable information more clearly.

The `offset` modifier allows you to grab a metric from a specific time in the past.

##### Hints!

##### Restart Counts

In order to measure how many restarts happened on a container within the last hours, use the `kube_pod_container_status_restarts_total` counter metric.

One option is, using the `max_over_time()` function and subtracting the `min_over_time()` function from it.

Another, more computationally efficient, option is, to use the [offset](https://prometheus.io/docs/prometheus/latest/querying/basics/#offset-modifier) modifier to subtract total restarts from 3 hours ago from current total restarts.
This is possible, since the counters only increase.

##### Request Rates per Bucket

You may have noticed, buckets containing the aggregated counts. For example the bucket with `le=10` (`le` meaning "lower equals") contains all requests that are shorter than 10 seconds, even if they are shorter than 0.3 seconds and therefore also in the bucket `le=0.3`. So a sharp increase in the nr. of requests in the `le=10` bucket is not necessarily a bad sign and we need to display it differently.

One way is to define a query for each bucket, subtracting the number of requests shorter than 1.5 seconds from the ones shorter than 10 seconds.
Use the `on` modifier to match by pod name (and potentially status code).

Another way to do it is to subtract the bucket counters from the total counters, basically turning it around. If you subtract for example the number of requests bucketed into the `le=10` label from the total, you will receive all the requests that are longer than 10 seconds. If you use the `le=1.5` label, the new metric will also include the requests longer than 10 seconds, but that may be what you want anyway.
To achieve this, you will have to tell Prometheus that it can match one vector (the total) to many others (the individual buckets) by using a `group_left` or `group_right` modifier and ignoring the `le` label.

Take a look at the [vector matching](https://prometheus.io/docs/prometheus/latest/querying/operators/#vector-matching) section of the docs to learn more about the `on` and the `group_x` keywords.
