# metr.ic

Simple metrics canister that polls data from your application canisters. The scheduling is done off-chain using [node-cron](https://www.npmjs.com/package/node-cron).

## Usage

In your application canister:

```motoko
import T "SharedTypes";

...

let Metrics = actor "ryjl3-tyaaa-aaaaa-aaaba-cai" : T.MetricsService;
Metrics.track({
  // Track a new attribute
  attributeId = null;

  action = #set({
    name = "user_count";

    // Optional description
    description = ?"Number of users who signed up.";

    // Getter function to read the data value
    getter = get_user_count;

    // If frequency is specified, the Metrics service will run on this schedule
    polling_frequency = ?{
      n = 5;
      period = #Minute;
    }
  })
})
```

## Self-hosted

You can deploy a metrics canister and run your own scheduler.

```sh
dfx canister create metrics
dfx build metrics
dfx deploy metrics

cd scheduler
npm i
npm start
```
