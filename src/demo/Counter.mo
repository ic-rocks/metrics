import ST "../SharedTypes"

actor Counter {

  var count = 0;

  public shared func init() : async ST.MetricsResponse {
    let Metrics = actor "ryjl3-tyaaa-aaaaa-aaaba-cai" : ST.MetricsService;
    await Metrics.track({
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
    })
  };

  public shared func inc() : async () { count += 1 };

  public shared func read() : async Nat { count };

  public shared func bump() : async Nat {
    count += 1;
    count;
  };
};
