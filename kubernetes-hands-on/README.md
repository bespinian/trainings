# Kubernetes Hands-On

## Configure kubectl to use your namespace

Configure kubectl to target your own namespace by default.

```sh
kubectl config set-context $(kubectl config current-context) --namespace=your-namespace
```

## Deploy the basic notification components

The resources subfolder contains all folders and files required for the training.

To get started, deploy the basic notification application.

Use `kubectl apply -f <filename>` on all the files in the folders

- 00-notification-db
- 01-notification-mq
- 02-notification-api

In the folder `04-notification-ui` you'll have to change the ingress configuration
to have a unique hostname. In order to do so, replace the prefix `tbd` in the hostname
with something unique, such as your kittens name.

Once you changed the hostname, use `kubectl` to apply all the configurations from the
folder `04-notification-ui`.

## Access the application

Your application should now be up and running.
The configuration exposes the web UI directly through an IP based load balancer,
as well as through a centralized ingress http proxy. The ingress http proxy has
been deployed on your cluster before and changes to ingress resources will be
automatically take effect on it.

To access your application through the IP load balancer find out the IP that
has been assigned to your load balancer type service for the UI by executing.

```sh
kubectl describe service notification-ui
```

You can enter this IP in your browser and pull up the UI.

> Many production environments will have security requirements, that prevent
> you from exposing your applications directly to the internet using load
> balancer services.
>
> Instead, ingress HTTP gateways should be used whenever possible.

To access your application through the ingress HTTP gateway enter the complete
hostname you previously configured in your configuration of the ingress resource.

> The hostname will be registered as a separate DNS A record, which takes about
> 5 minutes to be provisioned and available.

## The desired state principle in action

Kubernetes' desired state says, that there should be one instance (or replica)
of the notification UI pod running. This is what has been specified in our
deployment.

> Note!
> The deployment resource implicitly leads to the creation of a replica set.
> The replica set is ultimately what kubernetes looks at to delete
> or start pods, but it is largely transparent to kubernetes users.
> You can see, that at least one replica set has been created by each of
> the deployments by running `kubectl get replicaset`.

To create a conflict with the desired state, we can delete a pod through kubectl.

```sh
kubectl delete pod -l component=notification-ui
```

The command will delete all pods that have been given a label with
key `component` and value `notification-ui` and output the names of
all the deleted pods (in our case just one).

A new pod should be started almost immediately.

```sh
kubectl get pod -l component=notification-ui
```

The new pod will have a different suffix in it's name.

## Manual Scaling

There are multiple ways to initiate manual scaling.
While you can scale your workloads using imperative CLI commands, it is
recommended to scale production workloads using a centrally managed
resource config and applying it making use of the desired state.

### Preparation

Use a second CLI window and the linux command watch to get continuous updates on your pods:

```sh
watch "kubectl get pods"
```

Use another CLI window to execute the commands in the next chapters.

### Scale using the CLI

The following command tells kubernetes to scale a specific deployment
to 3 replicas.

```sh
kubectl scale deployment.apps/notification-api-deployment --replicas 3
```

Watch your second CLI window to see 2 more pods appear.

### Scale using kubectl edit

The following command will open the applied deployment resource configuration
in an editor. Within the `spec` node of the file, find the `replicas` property set it's value to `2` and save and exit the file.

```sh
kubectl edit deployment.apps/notification-api-deployment
```

You should see, one pod terminating and finally end up having 2 pods of the API.

### Scale using the configuration as code way

Edit your local copy of the yaml file for the config and use `kubectl apply` to apply the new config.

Take a look at your local copy of `notification-api-deployment.yaml` and
make sure it's configured for 1 replica. Apply the config and verify one
pod is shut down to comply with your intended state.

### Scaling vertically

You can set specific resource requests and limits for CPU and memory of
pods and containers within Kubernetes.

When scheduling a pod, Kubernetes guarantees, that the pod is scheduled
on a node that can serve the requested CPU and memory capacity and that
it is reserved. You can also set limits, which are an upper boundary that
the Kubernetes node will allow your pod or container to use. When it's
consuming more memory, it will be killed, if it tries to consume more CPU
it will be throttled.

Take a look at the deployment configuration of the notification API and
find out what it's resource requests and limits are.

For CPU, you can either specify whole CPU cores, or millicores.
Memory is usually specified using K, Ki, M, Mi, G or Gi etc. units,
with Ki, Mi and Gi being powers of 2 and the others being powers of 10.

Change one of the resources and apply the new config. It's hard to notice
a difference in the behaviour of the pod when you increase them. Reducing
them will lead to the pod being unable to start, because it starts too slow
or runs out of memory.

## Rolling Deployment

### Change the image

Modify the yaml of the **UI** deployment to use an older image version.
Use the tag `1.0.7` and apply the new config using `kubectl`.

Wait for the new deployment to finish by executing the command.

```sh
kubectl rollout status deployment notification-ui-deployment
```

The command will exit once the deployment has finished.
Now reload your browsers page. You should see the newer version being
visually different.

### Rolling Back

Show all revisions of the ui deployment.

```sh
kubectl rollout history deployment.apps/notification-ui-deployment
```

Rollback to the previous configuration. Choose the second to last
revision number.

```sh
kubectl rollout undo deployment.apps/notification-ui-deployment --to-revision=1
```

## Autoscaling

> Note!
> Before starting this exercise, make sure the API deployment running
> in Kubernetes has CPU requests and limits set to `100m` and a single
> replica.

The horizontal pod autoscaler is a Kubernetes resource that can check load
of pods / containers within a deployment and automatically add or remove
pods to ensure average load stays below a defined target.

The autoscale command is a simple way to get started. The command below
creates a horizontal pod autoscaler for the notification api deployment
and configures it to automatically add and remove replicas, so that
load stays below 50%, with a maximum of 5 replicas.

```sh
kubectl autoscale deployment notification-api-deployment --cpu-percent=50 --min=1 --max=5
```

Execute the autoscale command and use the command below to start a pod
to generate load on your api.

```sh
kubectl run load-generator --image=busybox --restart=Never \
 -- /bin/sh -c "while sleep 0.002; do wget -q -O- http://notification-api 1>/dev/null; done"
```

The load-generator makes 500 requests per second to the API which should
put load well over 50% on your pod.

The following command displays some info on the horizontal pod autoscaler
every two seconds.

```sh
watch -n 2 "kubectl get horizontalpodautoscalers.autoscaling notification-api-deployment"
```

Check the `TARGETS` values. It should quickly increase to over 50%.

A few seconds after the value increases, the `REPLICAS` column should
update too and show 3-5 replicas.

You can also see multiple API pods running now by using `kubectl get pods`.

Stop generating load by killing the pod.

```sh
kubectl delete pod load-generator
```

The load should now decrease and the autoscaler should remove pods.

Since the autoscaler is also configured in desired state, it can also
be configured through yaml or json. You can have a look at the configured
autoscaler by executing the following command.

```sh
kubectl get hpa notification-api-deployment -o yaml
```

Delete the autoscaler now.

```sh
kubectl delete horizontalpodautoscalers.autoscaling notification-api-deployment
```

## Explore network

Service resources are the Kubernetes way for service discovery.
Services are known to other pods in a namespace using their service name
as hostname. Each service has an IP.

Pods are also known to each other using their unique hostnames and
have assigned IP addresses within the cluster.

Start a pod that runs an image with curl available by applying
the file `99-debug/curl.yaml` from the resources folder.

Connect to the curl container interactively.

```sh
kubectl exec -it curl -- /bin/sh
```

You can now execute curl commands on a container within the cluster.

In another CLI window find the specific service name and internal IP of
the API.

```sh
kubectl get services
```

Send HTTP requests from your curl container to it. The response should
display the version number of the API. Try both the service name as well
as the IP address.

Also check the IP address of a running API pod. Send a request to it.
Make sure to connect to the right port, as you're circumventing the
services port remapping.
