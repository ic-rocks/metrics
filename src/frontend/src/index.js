import { Principal } from "@dfinity/principal";
import { Actor, HttpAgent } from "@dfinity/agent";
import {
  idlFactory as metrics_idl,
  canisterId as metrics_id,
} from "dfx-generated/Metrics";

const agent = new HttpAgent({ host: "http://127.0.0.1:8000" });
agent.fetchRootKey();
const metrics = Actor.createActor(metrics_idl, {
  agent,
  canisterId: metrics_id,
});

const stringify = (data) =>
  JSON.stringify(
    data,
    (key, value) =>
      typeof value === "bigint"
        ? value.toString()
        : value instanceof Principal
        ? value.toText()
        : Buffer.isBuffer(value)
        ? value.toString("hex")
        : value,
    2
  );

const get = async () => {
  document.getElementById("output").innerText = "Loading...";

  const attributes = await metrics.allActiveAttributes();
  console.log({ attributes });
  const results = await Promise.all(
    attributes.map(({ id }) => metrics.recordById(id))
  );
  console.log({ results });

  document.getElementById("output").innerText = stringify(results);
};

document.getElementById("clickMeBtn").addEventListener("click", get);

get();
