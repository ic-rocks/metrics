import Prim "mo:prim";
import Array "mo:base/Array";
import Buffer "mo:base/Buffer";
import Error "mo:base/Error";
import HashMap "mo:base/HashMap";
import Int "mo:base/Int";
import Nat "mo:base/Nat";
import Option "mo:base/Option";
import Principal "mo:base/Principal";
import Text "mo:base/Text";
import Time "mo:base/Time";
import Debug "mo:base/Debug";
import Result "mo:base/Result";

import T "Types";
import ST "../SharedTypes";


actor {
  let MAX_PAGE_SIZE = 200;
  // Minimum duration in between data points to prevent duplicates
  let MIN_TIME_BETWEEN = 30_000_000_000;
  let MINUTE_NANOSECONDS = 60_000_000_000;
  let HOUR_NANOSECONDS = 60 * MINUTE_NANOSECONDS;
  let DAY_NANOSECONDS = 24 * HOUR_NANOSECONDS;
  let WEEK_NANOSECONDS = 7 * DAY_NANOSECONDS;

  stable var dataList : [var ?T.AttributeRecord] = [var];

  public shared({ caller }) func track(request : ST.TrackerRequest) : async ST.MetricsResponse {
    let (id, data) = switch(request.attributeId) {
      case (?id_) {
        if (id_ >= dataList.size()) {
          return #err(#InvalidId);
        };
        switch(dataList[id_]) {
          case null {
            return #err(#InvalidId);
          };
          case (?data) {
            if (data.principal != caller) {
              return #err(#Unauthorized);
            };
            (id_, data)
          }
        }
      };
      case null {
        let id = dataList.size();
        switch(request.action) {
          case (#set(description_)) {
            ignore await description_.getter();
            let newRecord : T.AttributeRecord = {
              id = id;
              principal = caller;
              description = description_;
              series = [];
              status = #active;
            };
            (id, newRecord)
          };
          case (_) {
            return #err(#InvalidId);
          }
        }
      }
    };
    Debug.print("id " # Nat.toText(id));
    switch(request.action) {
      case (#set(_)) {
        if (id >= dataList.size()) {
          let newList : [?T.AttributeRecord] = Array.append(Array.freeze(dataList), [?data]);
          dataList := Array.thaw(newList);
        } else {
          dataList[id] := ?data;
        }
      };
      case (#unpause) {
        dataList[id] := ?{
          id = id;
          principal = data.principal;
          description = data.description;
          series = data.series;
          status = #active;
        };
      };
      case (#pause) {
        dataList[id] := ?{
          id = id;
          principal = data.principal;
          description = data.description;
          series = data.series;
          status = #paused;
        };
      };
      case (#delete) {
        dataList[id] := null;
      }
    };
    #ok(id)
  };

  public query func attributesByPrincipal(principal : Principal) : async [T.GetAttributeDescription] {
    Array.mapFilter<?T.AttributeRecord, T.GetAttributeDescription>(
      Array.freeze(dataList),
      func(rec: ?T.AttributeRecord) {
        switch (rec) {
          case (?data) {
            if (data.principal == principal ) {
              return ?{
                id = data.id;
                name = data.description.name;
                description = data.description.description;
                polling_frequency = data.description.polling_frequency;
                status = data.status;
              }
            }
          };
          case null {}
        };
        null
      }
    )
  };

  public query func allActiveAttributes() : async [T.GetAttributeDescription] {
    Array.mapFilter<?T.AttributeRecord, T.GetAttributeDescription>(
      Array.freeze(dataList),
      func(rec: ?T.AttributeRecord) {
        switch (rec) {
          case (?data) {
            if (data.status == #active ) {
              return ?{
                id = data.id;
                name = data.description.name;
                description = data.description.description;
                polling_frequency = data.description.polling_frequency;
                status = data.status;
              }
            }
          };
          case null {}
        };
        null
      }
    )
  };

  public query func recordById(request: ST.GetRequest) : async Result.Result<T.AttributeRecord, ST.MetricsError> {
    if (request.attributeId >= dataList.size()) {
      return #err(#InvalidId);
    };
    switch(dataList[request.attributeId]) {
      case null {
        #err(#InvalidId);
      };
      case (?data) {

        #ok({
          id = data.id;
          principal = data.principal;
          description = data.description;
          series = readSeries(data.series, request.before, request.limit, request.period);
          status = data.status;
        })
      }
    }
  };

  public func execute(id: ST.AttributeId) : async ST.MetricsResponse {
    if (id >= dataList.size()) {
      return #err(#InvalidId);
    };
    switch(dataList[id]){
      case null {
        return #err(#InvalidId);
      };
      case (?data) {
        if (data.status == #paused) {
          return #err(#AttributePaused);
        };

        let value = await data.description.getter();
        let ts = Time.now();
        let last = data.series[data.series.size() - 1];
        if (ts < last.timestamp + MIN_TIME_BETWEEN) {
          return #err(#FailedExecution);
        };
        dataList[id] := ?{
          id = data.id;
          principal = data.principal;
          description = data.description;
          series = Array.append(data.series, [{
            timestamp = ts;
            value = value;
          }]);
          status = data.status;
        };
        Debug.print("[" # Int.toText(ts) # "] id=" # Nat.toText(id) # ", value=" # Int.toText(value));
        #ok(id)
      }
    }
  };

  func readSeries(arr: [T.TimeSeries], maybeBefore: ?Int, maybeLimit: ?Nat, maybePeriod: ?ST.GetPeriod): [T.TimeSeries] {
    let limit = Nat.min(Option.get(maybeLimit, MAX_PAGE_SIZE), MAX_PAGE_SIZE);

    let timeEnd = switch(maybeBefore) {
      case (?before) before;
      case null      Time.now();
    };

    let timeOffset = switch(maybePeriod) {
      case (?(#Minute)) ?MINUTE_NANOSECONDS;
      case (?(#Hour))   ?HOUR_NANOSECONDS;
      case (?(#Day))    ?DAY_NANOSECONDS;
      case (?(#Week))   ?WEEK_NANOSECONDS;
      case null         null;
    };
    switch(timeOffset) {
      // Requesting a specific period.
      // Iterate backwards by timestamp and get the item immediately before that timestamp
      case (?offset) {
        let output = Buffer.Buffer<T.TimeSeries>(limit);
        var idx = arr.size();
        var count = 0;
        var timeCurr = timeEnd - (timeEnd % offset);
        while (idx > 0 and count < limit) {
          let item = arr[idx - 1];
          if (item.timestamp <= timeCurr) {
            output.add({
              timestamp = timeCurr;
              value = item.value;
            });
            timeCurr -= offset;
            count += 1;
          } else {
            idx -= 1;
          }
        };
        output.toArray()
      };

      // Just return the raw data
      case null {
        let filtered = Array.filter<T.TimeSeries>(arr, func(ts) {
          ts.timestamp < timeEnd
        });
        let size = filtered.size();
        if (size == 0 or limit == 0) {
          return [];
        };

        Prim.Array_tabulate<T.TimeSeries>(Nat.min(limit, size), func (i) {
          filtered.get(size - i - 1);
        });
      }
    }
  };
};
