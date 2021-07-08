import Buffer "mo:base/Buffer";
import Result "mo:base/Result";

module {
public type AttributeId = Nat;
public type Frequency = {
  n: Nat;
  period: { #Minute; #Hour; #Day };
};
public type AttributeDescription = {
  // Name of the attribute to be tracked
  name: Text;

  // Optional description of the attribute
  description: ?Text;

  // Getter function should return the value to be tracked
  getter: shared () -> async Int;

  // Specify a frequency to store periodic snapshots
  polling_frequency: ?Frequency;
};

public type TrackerRequest = {
  // Specify an attributeId to update existing record
  attributeId: ?AttributeId;

  action: {
    // Create or update an attribute
    #set: AttributeDescription;

    // Start tracking this data attribute if paused
    #unpause;

    // Stop tracking this data attribute
    #pause;

    // Remove all stored data for this attribute
    #delete;
  }
};

public type MetricsError = {
  #Unauthorized;
  #InvalidId;
  #FailedGettingValue;
  #FailedExecution;
  #AttributePaused;
};
public type MetricsResponse = Result.Result<AttributeId, MetricsError>;

public type GetPeriod = { #Minute; #Hour; #Day; #Week };
public type GetRequest = {
  attributeId: AttributeId;
  before: ?Int;
  limit: ?Nat;
  period: ?GetPeriod;
};

public type MetricsService = actor {
  track : TrackerRequest -> async MetricsResponse;
}
}
