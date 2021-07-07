import Buffer "mo:base/Buffer";
import Result "mo:base/Result";
import ST "../SharedTypes";

module {
public type Status = { #active; #paused };
public type GetAttributeDescription = {
  id: ST.AttributeId;
  name: Text;
  description: ?Text;
  polling_frequency: ?ST.Frequency;
  status: Status;
};
public type AttributeRecord = {
  id: ST.AttributeId;
  principal: Principal;
  description: ST.AttributeDescription;
  series: [TimeSeries];
  status: Status;
};
public type TimeSeries = {
  timestamp: Int;
  value: Int;
};
}
