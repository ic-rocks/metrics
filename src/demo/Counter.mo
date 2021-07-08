import Prim "mo:prim";
import Principal "mo:base/Principal";
import ExperimentalCycles "mo:base/ExperimentalCycles";
import ST "../SharedTypes";

actor Counter {

  stable var count = 0;
  stable var attributeId : ?ST.AttributeId = null;
  let Metrics = actor "ryjl3-tyaaa-aaaaa-aaaba-cai" : ST.MetricsService;

  public shared func track() : async ST.MetricsResponse {
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

  public shared func modify(desc: ST.AttributeDescription) : () {
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
    Prim.rts_max_live_size()
  };

  public query func cycles() : async Nat {
    ExperimentalCycles.balance()
  };
};
