# metrics

Simple pull-based metrics canister that retrieves data from your application canisters on a specified schedule. The scheduling is done off-chain using [node-cron](https://www.npmjs.com/package/node-cron).

For example, you can:

- Track user count every day
- Track memory usage every hour
- Track ICP balance every minute

Tracked data must be a `Nat` or `Int`. Currently, the minimum polling frequency is **one minute**.

The Metrics service makes all of its tracked data public and is consumed by ic.rocks.

## Links

🔗 [View Canister on ic.rocks](https://ic.rocks/principal/bsusq-diaaa-aaaah-qac5q-cai)

## Usage

In your application canister:

```motoko
import T "SharedTypes";

...
// This is the data you want to track
// Must be a shared function returning Nat or Int
public shared func get_user_count() : async Nat { ... };

let Metrics = actor "bsusq-diaaa-aaaah-qac5q-cai" : T.MetricsService;
let response = await Metrics.track({
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
});

// Save the attributeId
let attributeId = switch(response) {
  case (#ok(id)) ?id;
  case (#err(error)) null;
};
```

### Get Data Series

You can read raw data or get data by minute/hour/day/week. If `period` is specified, this will return the latest data point that is before each time period. Returns a maximum of 200 data points. You may specify a `before` timestamp for pagination.

```
Metrics.recordById({
  attributeId = someId;
  before = null;
  limit = null;
  period = ?(#Day);
})
```

### Listing Tracked Data

List all tracked data attributes for this Principal.

```
let myId : Principal = "...";
Metrics.attributesByPrincipal(myId);
```

### Modifying Details

You can modify details like name, description, or schedule. Only the principal that requested the tracking can modify it.

```
Metrics.track({
  attributeId = ?attributeId;
  action = #set({
    name = "user_count_hourly";
    description = ?"Number of users who signed up, per hour.";
    getter = get_user_count;
    polling_frequency = ?{
      n = 1;
      period = #Hour;
    }
  })
})
```

### Pausing/unpausing tracking

You can pause tracking temporarily and resume later.

```
Metrics.track({
  attributeId = ?attributeId;
  action = #pause;
})

Metrics.track({
  attributeId = ?attributeId;
  action = #unpause;
})
```

### Tracking cycles and memory

Add these functions for simple way to introspect cycles and memory.

```
import Prim "mo:prim";
import ExperimentalCycles "mo:base/ExperimentalCycles";

public query func memory() : async Nat {
  Prim.rts_heap_size()
};

public query func cycles() : async Nat {
  ExperimentalCycles.balance()
};
```

Then, track these attributes as usual.

---

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
