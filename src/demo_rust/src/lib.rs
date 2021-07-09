use ic_cdk::api::call::CallResult;
use ic_cdk::export::candid::{CandidType, Deserialize, Func, Nat, Principal};
use ic_cdk_macros::*;
use num_traits::cast::ToPrimitive;

#[allow(non_snake_case)]
#[derive(Clone, CandidType, Deserialize, Debug)]
pub struct TrackerRequest {
    pub attributeId: Option<Nat>,
    pub action: Action,
}

#[derive(Clone, CandidType, Deserialize, Debug)]
pub enum Action {
    Delete,
    Pause,
    Set(AttributeDescription),
    Unpause,
}

#[derive(Clone, CandidType, Deserialize, Debug)]
pub enum Period {
    Day,
    Hour,
    Minute,
}

#[derive(Clone, CandidType, Deserialize, Debug)]
pub struct Frequency {
    n: Nat,
    period: Period,
}

#[derive(Clone, CandidType, Deserialize, Debug)]
pub struct AttributeDescription {
    description: Option<String>,
    getter: Func,
    name: String,
    polling_frequency: Option<Frequency>,
}

#[derive(Clone, CandidType, Deserialize, Debug)]
pub enum MetricsError {
    AttributePaused,
    FailedExecution,
    FailedGettingValue,
    InvalidId,
    Unauthorized,
}

#[allow(non_camel_case_types)]
#[derive(Clone, CandidType, Deserialize, Debug)]
pub enum MetricsResponse {
    ok(Option<Nat>),
    err(MetricsError),
}

#[derive(CandidType, Deserialize, Clone, Debug)]
struct Counter(u64);

impl Default for Counter {
    fn default() -> Self {
        Counter(5)
    }
}

#[init]
fn init() {}

#[pre_upgrade]
fn pre_upgrade() {
    let tokens = ic_cdk::storage::get::<Counter>();
    match ic_cdk::storage::stable_save((tokens,)) {
        Ok(_) => (),
        Err(candid_err) => {
            ic_cdk::trap(&format!("[pre_upgrade] stable save error: {}", candid_err));
        }
    };
}

#[post_upgrade]
fn post_upgrade() {
    init();
    if let Ok((counter,)) = ic_cdk::storage::stable_restore::<(Counter,)>() {
        ic_cdk::storage::get_mut::<Counter>().0 = counter.0;
    }
}

#[query]
fn get() -> Nat {
    let counter = ic_cdk::storage::get::<Counter>();
    Nat::from(counter.0)
}

#[update]
fn set(val: Nat) {
    let counter = ic_cdk::storage::get_mut::<Counter>();
    counter.0 = val.0.to_u64().unwrap();
}

#[update]
fn inc() {
    let counter = ic_cdk::storage::get_mut::<Counter>();
    counter.0 += 1;
}

#[update]
async fn track() -> Option<MetricsResponse> {
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
        Principal::from_text("ryjl3-tyaaa-aaaaa-aaaba-cai").unwrap(),
        "track",
        (&track_args,),
    )
    .await;
    match result {
        Ok((response,)) => Some(response),
        Err(err) => {
            ic_cdk::print(format!("{:?}", err));
            None
        }
    }
}
