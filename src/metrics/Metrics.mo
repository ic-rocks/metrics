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
  stable var nextId = 0;
  stable var dataList : [var ?T.AttributeRecord] = [var];

  public shared({ caller }) func track(request : ST.TrackerRequest) : async ST.MetricsResponse {
    let (id, data) = switch(request.attributeId) {
      case (?id_) {
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
        let id = nextId;
        nextId += 1;
        switch(request.action) {
          case (#set(description_)) {
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
    #ok
  };

  public shared func attributesByPrincipal(principal : Principal) : async [T.GetAttributeDescription] {
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

  public shared func allActiveAttributes() : async [T.GetAttributeDescription] {
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

  public shared func recordById(id: ST.AttributeId) : async Result.Result<T.AttributeRecord, ST.MetricsError> {
    switch(dataList[id]) {
      case null {
        #err(#InvalidId);
      };
      case (?data) {
        #ok(data)
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
        #ok
      }
    }
  }
};
