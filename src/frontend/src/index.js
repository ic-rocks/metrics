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

export const stringify = (data) =>
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
  const container = document.getElementById("output");
  container.innerHTML = "Loading...";

  const period = document.getElementById("period").value;

  const attributesByPrincipal = await metrics.attributesByPrincipal(
    await agent.getPrincipal()
  );
  const attributes = await metrics.allActiveAttributes();
  const allAttributeIds = [
    ...new Set(
      attributesByPrincipal.concat(attributes).map(({ id }) => Number(id))
    ),
  ].sort((a, b) => a - b);

  console.log({ allAttributeIds });
  const results = await Promise.all(
    allAttributeIds.map((id) =>
      metrics.recordById({
        attributeId: BigInt(id),
        before: [],
        limit: [50],
        period: period ? [{ [period]: null }] : [],
      })
    )
  );

  container.innerHTML = "";
  results.forEach((res) => {
    if (res.err) return res.err;
    const out = res.ok;
    const div = document.createElement("div");

    const textarea = `<textarea>
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
</textarea>`;
    div.innerHTML = textarea;
    const feedback = document.createElement("pre");
    const pauseButton = document.createElement("button");
    pauseButton.innerText = "pause";
    pauseButton.onclick = async () => {
      feedback.innerText = "pausing...";
      const ret = await metrics.track({
        attributeId: [out.id],
        action: {
          pause: null,
        },
      });
      console.log(ret);
      feedback.innerText = stringify(ret);
    };
    div.appendChild(pauseButton);
    const unpauseButton = document.createElement("button");
    unpauseButton.innerText = "unpause";
    unpauseButton.onclick = async () => {
      feedback.innerText = "unpausing...";
      const ret = await metrics.track({
        attributeId: [out.id],
        action: {
          unpause: null,
        },
      });
      console.log(ret);
      feedback.innerText = stringify(ret);
    };
    div.appendChild(unpauseButton);
    const deleteButton = document.createElement("button");
    deleteButton.innerText = "delete";
    deleteButton.onclick = async () => {
      feedback.innerText = "deleting...";
      const ret = await metrics.track({
        attributeId: [out.id],
        action: {
          delete: null,
        },
      });
      console.log(ret);
      feedback.innerText = stringify(ret);
    };
    div.appendChild(deleteButton);
    div.appendChild(feedback);
    container.appendChild(div);
  });
  console.log({ results });
};

document.getElementById("clickMeBtn").addEventListener("click", get);

document.getElementById("add").addEventListener("click", add);

get();
