import Prim "mo:prim";
import Principal "mo:base/Principal";
import ExperimentalCycles "mo:base/ExperimentalCycles";
import T "../Types";

actor Counter {

  stable var count = 0;
  stable var attributeId : ?T.AttributeId = null;
  let Metrics = actor "bsusq-diaaa-aaaah-qac5q-cai" : T.MetricsService;

  public shared func track() : async T.MetricsResponse {
    let response = await Metrics.track({
      attributeId = null;
      action = #set({
        name = "counter";
        description = ?"the best counter";
        getter = read;
        polling_frequency = ?{
          n = 5;
          period = #Minute;
        }
      })
    });
    attributeId := switch(response) {
      case (#ok(id)) ?id;
      case (#err(error)) null;
    };
    response
  };

  public shared func modify(desc: T.AttributeDescription) : () {
    switch(attributeId) {
      case (?id) {
        ignore await Metrics.track({
          attributeId = ?id;
          action = #set(desc);
        })
      };
      case (_) {}
    }
  };

  public shared func pause() : () {
    switch(attributeId) {
      case (?id) {
        ignore await Metrics.track({
          attributeId = ?id;
          action = #pause;
        })
      };
      case (_) {}
    }
  };

  public shared func unpause() : () {
    switch(attributeId) {
      case (?id) {
        ignore await Metrics.track({
          attributeId = ?id;
          action = #unpause;
        })
      };
      case (_) {}
    }
  };

  public shared func delete() : () {
    switch(attributeId) {
      case (?id) {
        ignore await Metrics.track({
          attributeId = ?id;
          action = #delete;
        });
        attributeId := null;
      };
      case (_) {}
    }
  };

  public shared func inc() : async () { count += 1 };

  public shared query func read() : async Nat { count };

  public shared func bump() : async Nat {
    count += 1;
    count;
  };

  public query func memory() : async Nat {
    Prim.rts_heap_size()
  };

  public query func cycles() : async Nat {
    ExperimentalCycles.balance()
  };
};
