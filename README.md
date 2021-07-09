# metrics

Simple pull-based metrics canister that reads and saves data from your application canisters on a specified schedule. Scheduling is currently done off-chain.

For example, you can:

- Track user count every day
- Track memory usage every 2 hours
- Track ICP balance every 15 minutes

Tracked data must be a `Nat` or `Int`. Currently, the minimum polling frequency is **one minute**. If you have more real-time data, such as markets data, this is probably not the most optimal solution.

The Metrics service makes all of its tracked data public and is consumed by ic.rocks.

## Links

🔗 [View Canister on ic.rocks](https://ic.rocks/principal/bsusq-diaaa-aaaah-qac5q-cai)

## Usage (Motoko)

Grab the [candid](./lib/Metrics.did) or [motoko types](./src/Types.mo). In your application canister:

```motoko
import T "Types";

...
// This is the data you want to track
// Must be a shared function returning Nat or Int
public shared func get_user_count() : async Nat { ... };

let Metrics = actor "bsusq-diaaa-aaaah-qac5q-cai" : T.MetricsService;
let response = await Metrics.track({
  // Track a new attribute
  attributeId = null;

  action = #Set({
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

## Usage (Rust)

A rust example can be found [here](./src/demo_rust/src/lib.rs).

```rust
let track_args = TrackerRequest {
    attributeId: None,
    action: Action::Set(AttributeDescription {
        name: String::from("rust-counter"),
        description: Some(String::from("A demo from rust")),
        polling_frequency: Some(Frequency {
            n: Nat::from(5),
            period: Period::Minute,
        }),
        getter: Func {
            principal: Principal::from_text("r7inp-6aaaa-aaaaa-aaabq-cai").unwrap(),
            method: String::from("get"),
        },
    }),
};
let result: CallResult<(MetricsResponse,)> = ic_cdk::api::call::call(
    Principal::from_text("bsusq-diaaa-aaaah-qac5q-cai").unwrap(),
    "track",
    (&track_args,),
)
.await;
```

---

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
  action = #Set({
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
  action = #Pause;
})

Metrics.track({
  attributeId = ?attributeId;
  action = #Unpause;
})
```

You can also delete the entire data attribute and history by specifying the `#Delete` action. **WARNING**: This is non-reversible!

### Tracking cycles and memory

Add these functions for a simple way to introspect cycles and memory.

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

You can deploy a metrics canister and run your own scheduler. The default implementation uses [node-cron](https://www.npmjs.com/package/node-cron).

```sh
dfx canister create metrics
dfx build metrics
dfx deploy metrics

cd scheduler
npm i
npm start
```
