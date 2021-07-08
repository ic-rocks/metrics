import { Principal } from "@dfinity/principal";
import { Actor, HttpAgent } from "@dfinity/agent";
import { Ed25519KeyIdentity } from "@dfinity/identity";
import {
  idlFactory as metrics_idl,
  canisterId as metrics_id,
} from "dfx-generated/Metrics";
import { canisterId as CounterId } from "dfx-generated/Counter";

function newIdentity() {
  const entropy = crypto.getRandomValues(new Uint8Array(32));
  const identity = Ed25519KeyIdentity.generate(entropy);
  localStorage.setItem("id", JSON.stringify(identity));
  return identity;
}

function readIdentity() {
  const stored = localStorage.getItem("id");
  if (!stored) {
    return newIdentity();
  }
  try {
    return Ed25519KeyIdentity.fromJSON(stored);
  } catch (error) {
    console.log(error);
    return newIdentity();
  }
}

const identity = readIdentity();
const agent = new HttpAgent({ identity, host: "http://127.0.0.1:8000" });
agent.fetchRootKey();
const metrics = Actor.createActor(metrics_idl, {
  agent,
  canisterId: metrics_id,
});

const add = async () => {
  const name = document.getElementById("add-function").value;
  if (!name) return;
  const freqN = document.getElementById("frequency-n").value;
  const freqPeriod = document.getElementById("frequency-period").value;

  const request = {
    attributeId: [],
    action: {
      set: {
        name,
        description: [`Added using UI: ${name}`],
        getter: [Principal.fromText(CounterId), name],
        polling_frequency: [
          {
            n: BigInt(freqN),
            period: {
              [freqPeriod]: null,
            },
          },
        ],
      },
    },
  };
  document.getElementById("add-output").innerText = `Submitting...`;
  const newId = await metrics.track(request);
  console.log({ newId });

  document.getElementById(
    "add-output"
  ).innerText = `New attribute id: ${newId.ok}`;
};

const get = async () => {
  document.getElementById("output").innerText = "Loading...";

  const period = document.getElementById("period").value;
  console.log({ period });

  const attributes = await metrics.allActiveAttributes();
  console.log({ attributes });
  const results = await Promise.all(
    attributes.map(({ id }) =>
      metrics.recordById({
        attributeId: id,
        before: [],
        limit: [50],
        period: period ? [{ [period]: null }] : [],
      })
    )
  );
  const output = results.map((res) => {
    if (res.err) return res.err;
    const out = res.ok;
    return `
id: ${out.id}
status: ${Object.keys(out.status)[0]}
principal: ${out.principal}
name: ${out.description.name}
description: ${out.description.description[0] || ""}
polling_frequency: ${
      out.description.polling_frequency[0]
        ? `${out.description.polling_frequency[0].n} ${
            Object.keys(out.description.polling_frequency[0].period)[0]
          }`
        : ""
    }
getter: ${out.description.getter.join(".")}
series:
${out.series
  .map(({ value, timestamp }) =>
    [new Date(Number(timestamp / BigInt(1e6))).toISOString(), value].join(" ")
  )
  .join("\n")}
    `;
  });
  console.log({ results });

  document.getElementById("output").innerText = output;
};

document.getElementById("clickMeBtn").addEventListener("click", get);

document.getElementById("add").addEventListener("click", add);

get();
