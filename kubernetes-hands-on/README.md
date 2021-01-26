# Kubernetes Hands-On

## Configure kubectl to use your namespace

```sh
kubectl config set-context $(kubectl config current-context) --namespace=your-namespace
```

## Deploy the basic notification components

Use `kubectl apply -f <filename>` on all the files in the folders

- notification-db
- notification-mq
- notification-api
- notification-ui

## Rolling Deployment

### Change the image

Modify the yaml of the UI deployment to use an older image version.
Use the tag `1.0.3` and apply the new config using `kubectl`.

Wait for the new deployment to finish by executing the command

```sh
kubectl rollout status deployment notification-ui-deployment
```

The command will exit once the deployment has finished.

### Rolling Back

Look at revisions of the ui deployment:

```sh
kubectl rollout history deployment.apps/notification-ui-deployment
```

Rollback to the previous configuration.

```sh
kubectl rollout undo deployment.apps/notification-ui-deployment --to-revision=1
```

## Scaling

### Preparation

Use a second CLI window and the linux command watch to get continuous updates on your pods:

```sh
watch "kubectl get pods"
```

Execute the other pods in another CLI window and watch this one to see the scaling in action.

### Scale using the CLI

```sh
kubectl scale deployment.apps/notification-api-deployment --replicas 3
```

### Scale using kubectl edit

```sh
kubectl edit deployment.apps/notification-api-deployment
```

### Scale using the configuration as code way

Edit your local copy of the yaml file for the config and use `kubectl apply` to apply the new config.

## Autoscaling

tbd

kubectl autoscale deployment notification-api-deployment --cpu-percent=50 --min=1 --max=10

kubectl run load-generator2 --image=busybox --restart=Never -- /bin/sh -c "while sleep 0.002; do wget -q -O- http://notification-api 1>/dev/null; done"

watch -n 2 "kubectl get hpa"

kubectl get hpa notification-api-deployment -o yaml

## Explore network

apply curlimage

connect to curl image using exec

connect to the api on it's internal servicename and IP
